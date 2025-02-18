/* Copyright (c) 2023 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/. */

#include "brave/components/brave_vpn/browser/connection/brave_vpn_os_connection_api.h"

#include "base/check_is_test.h"
#include "base/feature_list.h"
#include "base/memory/scoped_refptr.h"
#include "brave/components/brave_vpn/common/features.h"
#include "build/build_config.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"

namespace brave_vpn {

std::unique_ptr<BraveVPNOSConnectionAPI> CreateBraveVPNIKEv2ConnectionAPI(
    scoped_refptr<network::SharedURLLoaderFactory> url_loader_factory,
    PrefService* local_prefs,
    version_info::Channel channel);

std::unique_ptr<BraveVPNOSConnectionAPI> CreateBraveVPNWireguardConnectionAPI(
    scoped_refptr<network::SharedURLLoaderFactory> url_loader_factory,
    PrefService* local_prefs,
    version_info::Channel channel);

std::unique_ptr<BraveVPNOSConnectionAPI> CreateBraveVPNConnectionAPI(
    scoped_refptr<network::SharedURLLoaderFactory> url_loader_factory,
    PrefService* local_prefs,
    version_info::Channel channel) {
#if BUILDFLAG(IS_WIN)
  if (base::FeatureList::IsEnabled(features::kBraveVPNUseWireguardService)) {
    return CreateBraveVPNWireguardConnectionAPI(url_loader_factory, local_prefs,
                                                channel);
  }
#endif

#if BUILDFLAG(IS_ANDROID)
  // Android doesn't use connection api.
  return nullptr;
#else
  return CreateBraveVPNIKEv2ConnectionAPI(url_loader_factory, local_prefs,
                                          channel);
#endif
}

BraveVPNOSConnectionAPI::BraveVPNOSConnectionAPI(
    scoped_refptr<network::SharedURLLoaderFactory> url_loader_factory,
    PrefService* local_prefs)
    : url_loader_factory_(url_loader_factory),
      region_data_manager_(url_loader_factory, local_prefs) {
  DCHECK(url_loader_factory_);
  // Safe to use Unretained here because |region_data_manager_| is owned
  // instance.
  region_data_manager_.set_selected_region_changed_callback(
      base::BindRepeating(&BraveVPNOSConnectionAPI::NotifySelectedRegionChanged,
                          base::Unretained(this)));
  region_data_manager_.set_region_data_ready_callback(base::BindRepeating(
      &BraveVPNOSConnectionAPI::NotifyRegionDataReady, base::Unretained(this)));
  net::NetworkChangeNotifier::AddNetworkChangeObserver(this);
}

BraveVPNOSConnectionAPI::~BraveVPNOSConnectionAPI() {
  net::NetworkChangeNotifier::RemoveNetworkChangeObserver(this);
}

mojom::ConnectionState BraveVPNOSConnectionAPI::GetConnectionState() const {
  return connection_state_;
}

BraveVPNRegionDataManager& BraveVPNOSConnectionAPI::GetRegionDataManager() {
  return region_data_manager_;
}

void BraveVPNOSConnectionAPI::AddObserver(Observer* observer) {
  observers_.AddObserver(observer);
}

void BraveVPNOSConnectionAPI::RemoveObserver(Observer* observer) {
  observers_.RemoveObserver(observer);
}

void BraveVPNOSConnectionAPI::SetConnectionStateForTesting(
    mojom::ConnectionState state) {
  UpdateAndNotifyConnectionStateChange(state);
}

void BraveVPNOSConnectionAPI::NotifyRegionDataReady(bool ready) const {
  for (auto& obs : observers_) {
    obs.OnRegionDataReady(ready);
  }
}

void BraveVPNOSConnectionAPI::NotifySelectedRegionChanged(
    const std::string& name) const {
  for (auto& obs : observers_) {
    obs.OnSelectedRegionChanged(name);
  }
}

void BraveVPNOSConnectionAPI::OnNetworkChanged(
    net::NetworkChangeNotifier::ConnectionType type) {
  VLOG(1) << __func__ << " : " << type;
  CheckConnection();
}

BraveVpnAPIRequest* BraveVPNOSConnectionAPI::GetAPIRequest() {
  if (!url_loader_factory_) {
    CHECK_IS_TEST();
    return nullptr;
  }

  if (!api_request_) {
    api_request_ = std::make_unique<BraveVpnAPIRequest>(url_loader_factory_);
  }

  return api_request_.get();
}

void BraveVPNOSConnectionAPI::ResetConnectionState() {
  // Don't use UpdateAndNotifyConnectionStateChange() to update connection state
  // and set state directly because we have a logic to ignore disconnected state
  // when connect failed.
  connection_state_ = mojom::ConnectionState::DISCONNECTED;
  for (auto& obs : observers_) {
    obs.OnConnectionStateChanged(connection_state_);
  }
}

void BraveVPNOSConnectionAPI::UpdateAndNotifyConnectionStateChange(
    mojom::ConnectionState state) {
  // this is a simple state machine for handling connection state
  if (connection_state_ == state) {
    return;
  }

  connection_state_ = state;
  for (auto& obs : observers_) {
    obs.OnConnectionStateChanged(connection_state_);
  }
}

bool BraveVPNOSConnectionAPI::QuickCancelIfPossible() {
  if (!api_request_) {
    return false;
  }

  // We're waiting responce from vpn server.
  // Can do quick cancel in this situation by cancel that request.
  ResetAPIRequestInstance();
  return true;
}

void BraveVPNOSConnectionAPI::ResetAPIRequestInstance() {
  api_request_.reset();
}

std::string BraveVPNOSConnectionAPI::GetLastConnectionError() const {
  return last_connection_error_;
}

void BraveVPNOSConnectionAPI::SetLastConnectionError(const std::string& error) {
  VLOG(2) << __func__ << " : " << error;
  last_connection_error_ = error;
}

}  // namespace brave_vpn
