/* Copyright (c) 2020 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

#include "brave/components/brave_ads/core/internal/privacy/locale/country_code_util.h"

#include "testing/gtest/include/gtest/gtest.h"

// npm run test -- brave_unit_tests --filter=BraveAds*

namespace brave_ads::privacy::locale {

TEST(BraveAdsCountryCodeUtilTest, IsCountryCodeMemberOfAnonymitySet) {
  // Arrange

  // Act

  // Assert
  EXPECT_TRUE(IsCountryCodeMemberOfAnonymitySet("US"));
}

TEST(BraveAdsCountryCodeUtilTest, IsCountryCodeNotMemberOfAnonymitySet) {
  // Arrange

  // Act

  // Assert
  EXPECT_FALSE(IsCountryCodeMemberOfAnonymitySet("XX"));
}

TEST(BraveAdsCountryCodeUtilTest, ShouldClassifyCountryCodeAsOther) {
  // Arrange

  // Act

  // Assert
  EXPECT_TRUE(ShouldClassifyCountryCodeAsOther("CX"));
}

TEST(BraveAdsCountryCodeUtilTest, ShouldNotClassifyCountryCodeAsOther) {
  // Arrange

  // Act

  // Assert
  EXPECT_FALSE(ShouldClassifyCountryCodeAsOther("XX"));
}

}  // namespace brave_ads::privacy::locale
