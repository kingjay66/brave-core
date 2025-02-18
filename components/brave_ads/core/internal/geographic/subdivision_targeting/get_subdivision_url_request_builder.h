/* Copyright (c) 2020 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

#ifndef BRAVE_COMPONENTS_BRAVE_ADS_CORE_INTERNAL_GEOGRAPHIC_SUBDIVISION_TARGETING_GET_SUBDIVISION_URL_REQUEST_BUILDER_H_
#define BRAVE_COMPONENTS_BRAVE_ADS_CORE_INTERNAL_GEOGRAPHIC_SUBDIVISION_TARGETING_GET_SUBDIVISION_URL_REQUEST_BUILDER_H_

#include "brave/components/brave_ads/common/interfaces/brave_ads.mojom-forward.h"
#include "brave/components/brave_ads/core/internal/common/url/request_builder/url_request_builder_interface.h"

namespace brave_ads {

class GetSubdivisionUrlRequestBuilder final
    : public UrlRequestBuilderInterface {
 public:
  mojom::UrlRequestInfoPtr Build() override;
};

}  // namespace brave_ads

#endif  // BRAVE_COMPONENTS_BRAVE_ADS_CORE_INTERNAL_GEOGRAPHIC_SUBDIVISION_TARGETING_GET_SUBDIVISION_URL_REQUEST_BUILDER_H_
