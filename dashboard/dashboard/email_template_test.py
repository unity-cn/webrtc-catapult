# Copyright 2015 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

from __future__ import print_function
from __future__ import division
from __future__ import absolute_import

import unittest

from dashboard import email_template


class EmailTemplateTest(unittest.TestCase):

  def testURLEncoding(self):
    actual_output = email_template.GetReportPageLink(
        'ABC/bot-name/abc-perf-test/passed%', '1415919839')

    self.assertEqual(('https://chromeperf.appspot.com/report?masters=ABC&'
                      'bots=bot-name&tests=abc-perf-test%2Fpassed%25'
                      '&checked=passed%25%2Cpassed%25_ref%2Cref&'
                      'rev=1415919839'), actual_output)

    actual_output_no_host = email_template.GetReportPageLink(
        'ABC/bot-name/abc-perf-test/passed%',
        '1415919839',
        add_protocol_and_host=False)

    self.assertEqual(('/report?masters=ABC&bots=bot-name&tests='
                      'abc-perf-test%2Fpassed%25&checked=passed%25%2C'
                      'passed%25_ref%2Cref&rev=1415919839'),
                     actual_output_no_host)


if __name__ == '__main__':
  unittest.main()
