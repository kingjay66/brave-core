/* Copyright (c) 2022 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

#include "brave/components/brave_ads/core/internal/flags/did_override/did_override_command_line_switch_values_util.h"

#include <memory>
#include <string>
#include <utility>

#include "base/strings/string_util.h"
#include "base/test/scoped_feature_list.h"
#include "brave/components/brave_ads/core/internal/common/unittest/command_line_switch_info.h"
#include "brave/components/brave_ads/core/internal/common/unittest/unittest_base.h"
#include "brave/components/brave_ads/core/internal/common/unittest/unittest_command_line_switch_util.h"
#include "components/variations/variations_switches.h"

// npm run test -- brave_unit_tests --filter=BraveAds*

namespace brave_ads {

namespace {

constexpr char kFooBarSwitch[] = "foobar";

struct ParamInfo final {
  CommandLineSwitchInfo command_line_switch;
  bool expected_did_override_command_line_switch;
} const kTests[] = {
    {{kFooBarSwitch, {}}, false},
    {{variations::switches::kFakeVariationsChannel, {}}, false},
    {{variations::switches::kFakeVariationsChannel, "FooBar"}, true},
    {{variations::switches::kVariationsOverrideCountry, {}}, false},
    {{variations::switches::kVariationsOverrideCountry, "FooBar"}, true}};

}  // namespace

class BraveAdsDidOverrideCommandLineSwitchValuesUtilTest
    : public UnitTestBase,
      public ::testing::WithParamInterface<ParamInfo> {
 protected:
  void SetUpMocks() override {
    const ParamInfo param = GetParam();

    AppendCommandLineSwitches({param.command_line_switch});

    std::unique_ptr<base::FeatureList> feature_list =
        std::make_unique<base::FeatureList>();
    feature_list->InitializeFromCommandLine(param.command_line_switch.value,
                                            {});
    scoped_feature_list_.InitWithFeatureList(std::move(feature_list));
  }

  base::test::ScopedFeatureList scoped_feature_list_;
};

TEST_P(BraveAdsDidOverrideCommandLineSwitchValuesUtilTest,
       DidOverrideCommandLineSwitchValues) {
  // Arrange

  // Act

  // Assert
  EXPECT_EQ(GetParam().expected_did_override_command_line_switch,
            DidOverrideCommandLineSwitchValues());
}

std::string TestParamToString(
    const ::testing::TestParamInfo<ParamInfo>& test_param) {
  const std::string expected_did_override_command_line_switch =
      test_param.param.expected_did_override_command_line_switch
          ? "DidOverride"
          : "DidNotOverride";

  const std::string sanitized_command_line_switch =
      SanitizeCommandLineSwitch(test_param.param.command_line_switch);

  return base::ReplaceStringPlaceholders(
      "Set$1CommandLineSwitchValuesFor$2",
      {expected_did_override_command_line_switch,
       sanitized_command_line_switch},
      nullptr);
}

INSTANTIATE_TEST_SUITE_P(,
                         BraveAdsDidOverrideCommandLineSwitchValuesUtilTest,
                         testing::ValuesIn(kTests),
                         TestParamToString);

}  // namespace brave_ads
