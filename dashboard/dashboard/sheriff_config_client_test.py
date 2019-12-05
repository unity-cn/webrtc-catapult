# Copyright 2017 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import json

from dashboard import speed_releasing
from dashboard.common import testing_common
from dashboard.models.sheriff import Sheriff
from dashboard.sheriff_config_client import SheriffConfigClient
import mock
from google.appengine.ext import ndb

_SAMPLE_BOTS = ['ChromiumPerf/win', 'ChromiumPerf/linux']
_DOWNSTREAM_BOTS = ['ClankInternal/win', 'ClankInternal/linux']
_SAMPLE_TESTS = ['my_test_suite/my_test', 'my_test_suite/my_other_test']
_SAMPLE_LAYOUT = ('{ "my_test_suite/my_test": ["Foreground", '
                  '"Pretty Name 1"],"my_test_suite/my_other_test": '
                  ' ["Foreground", "Pretty Name 2"]}')


RECENT_REV = speed_releasing.CHROMIUM_MILESTONES[
    speed_releasing.CURRENT_MILESTONE][0] + 42


@mock.patch.object(SheriffConfigClient, '__init__',
                   mock.MagicMock(return_value=None))
class SheriffConfigClientTest(testing_common.TestCase):

  class _Response(object):
    # pylint: disable=invalid-name

    def __init__(self, ok, text):
      self.ok = ok
      self.text = text

    def json(self):
      return json.loads(self.text)

  class _Session(object):

    def __init__(self, response):
      self._response = response

    def get(self, *_args, **_kargs):
      # pylint: disable=unused-argument
      return self._response

    def post(self, *_args, **_kargs):
      # pylint: disable=unused-argument
      return self._response

  def testMatch(self):
    clt = SheriffConfigClient()
    response_text = """
    {
      "subscriptions": [
        {
          "config_set": "projects/catapult",
          "revision": "c9d4943dc832e448f9786e244f918fdabc1e5303",
          "subscription": {
            "name": "Public Team1",
            "rotation_url": "https://some/url",
            "notification_email": "public@mail.com",
            "bug_labels": [
              "Lable1",
              "Lable2"
            ],
            "bug_components": [
              "foo>bar"
            ],
            "visibility": "PUBLIC",
            "patterns": [
              {
                "glob": "Foo2/*/Bar2/*"
              },
              {
                "regex": ".*"
              }
            ]
          }
        }
      ]
    }
    """
    clt._session = self._Session(self._Response(True, response_text))
    expected = [
        Sheriff(
            key=ndb.Key('Sheriff', 'Public Team1'),
            url='https://some/url',
            email='public@mail.com',
            internal_only=False,
            patterns=['Foo2/*/Bar2/*'],
            labels=['Lable1', 'Lable2', 'Component-foo-bar'],
        ),
    ]
    self.assertEqual(clt.Match('Foo2/a/Bar2/b'), (expected, None))
