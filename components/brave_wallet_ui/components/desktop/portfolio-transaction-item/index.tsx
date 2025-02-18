// Copyright (c) 2021 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at https://mozilla.org/MPL/2.0/.

import * as React from 'react'
import { useDispatch } from 'react-redux'
import { useHistory } from 'react-router'
import * as EthereumBlockies from 'ethereum-blockies'

// Types
import {
  BraveWallet,
  SerializableTransactionInfo,
  WalletRoutes
} from '../../../constants/types'

// Utils
import { formatDateAsRelative, serializedTimeDeltaToJSDate } from '../../../utils/datetime-utils'
import Amount from '../../../utils/amount'
import { copyToClipboard } from '../../../utils/copy-to-clipboard'
import { getLocale } from '../../../../common/locale'
import { WalletActions } from '../../../common/actions'
import {
  getGasFeeFiatValue,
  getTransactionFormattedSendCurrencyTotal,
  getTransactionGasFee,
  getTransactionStatusString,
  isFilecoinTransaction,
  isSolanaTransaction,
  getTransactionToAddress,
  getIsTxApprovalUnlimited,
  findTransactionToken,
  getTransactionApprovalTargetAddress,
  getTransactionErc721TokenId,
  isSwapTransaction,
  getETHSwapTransactionBuyAndSellTokens,
  getTransactionTokenSymbol,
  getTransactionTransferredValue
} from '../../../utils/tx-utils'
import { findTokenBySymbol } from '../../../utils/asset-utils'
import {
  accountInfoEntityAdaptor,
  accountInfoEntityAdaptorInitialState
} from '../../../common/slices/entities/account-info.entity'
import { selectAllUserAssetsFromQueryResult } from '../../../common/slices/entities/blockchain-token.entity'
import { makeNetworkAsset } from '../../../options/asset-options'
import { getCoinFromTxDataUnion } from '../../../utils/network-utils'
import { WalletSelectors } from '../../../common/selectors'
import { getAddressLabelFromRegistry } from '../../../utils/account-utils'
import { openBlockExplorerURL } from '../../../utils/block-explorer-utils'

// Hooks
import { useExplorer } from '../../../common/hooks'
import {
  useGetAccountInfosRegistryQuery,
  useGetDefaultFiatCurrencyQuery,
  useGetNetworkQuery,
  useGetTokenSpotPriceQuery,
  useGetUserTokensRegistryQuery
} from '../../../common/slices/api.slice'
import {
  useUnsafeWalletSelector
} from '../../../common/hooks/use-safe-selector'

// Styled Components
import {
  AddressOrAsset,
  ArrowIcon,
  BalanceColumn,
  CoinsButton,
  CoinsIcon,
  DetailColumn,
  DetailRow,
  DetailTextDark,
  DetailTextDarkBold,
  DetailTextLight,
  RejectedTransactionSpacer,
  FromCircle,
  MoreButton,
  MoreIcon,
  StatusRow,
  PortfolioTransactionItemWrapper,
  ToCircle,
  OrbAndTxDescriptionContainer,
  TransactionFeeTooltipBody,
  TransactionFeeTooltipTitle,
  StatusBalanceAndMoreContainer,
  OrbWrapper,
  BalanceAndMoreRow,
  CoinsButtonSpacer
} from './style'
import { StatusBubble } from '../../shared/style'
import TransactionFeesTooltip from '../transaction-fees-tooltip'
import TransactionPopup, { TransactionPopupItem } from '../transaction-popup'
import TransactionTimestampTooltip from '../transaction-timestamp-tooltip'
import { Skeleton, LoadingSkeletonStyleProps } from '../../shared/loading-skeleton/styles'

export interface Props {
  transaction: BraveWallet.TransactionInfo | SerializableTransactionInfo
  displayAccountName: boolean
  isFocused?: boolean
}

const skeletonProps: LoadingSkeletonStyleProps = {
  width: '38px',
  height: '14px',
  enableAnimation: true
}

export const PortfolioTransactionItem = React.forwardRef<HTMLDivElement, Props>(({
  transaction,
  displayAccountName,
  isFocused
}: Props, forwardedRef) => {
  // routing
  const history = useHistory()

  // redux
  const dispatch = useDispatch()
  const fullTokenList = useUnsafeWalletSelector(WalletSelectors.fullTokenList)
  const solFeeEstimates = useUnsafeWalletSelector(
    WalletSelectors.solFeeEstimates
  )

  // partial tx parsing
  const gasFee = getTransactionGasFee(transaction, solFeeEstimates)
  const isFilecoinTx = isFilecoinTransaction(transaction)
  const isSolanaTx = isSolanaTransaction(transaction)
  const recipient = getTransactionToAddress(transaction)
  const approvalTarget = getTransactionApprovalTargetAddress(transaction)
  const erc721TokenId = getTransactionErc721TokenId(transaction)
  const isSwap = isSwapTransaction(transaction)
  const txCoinType = getCoinFromTxDataUnion(transaction.txDataUnion)

  // queries
  const {
    data: defaultFiatCurrency = '',
    isLoading: isLoadingDefaultFiatCurrency
  } = useGetDefaultFiatCurrencyQuery(undefined)

  const {
    data: txNetwork,
    isLoading: isLoadingTxNetwork //
  } = useGetNetworkQuery({
    chainId: transaction.chainId,
    coin: txCoinType
  })

  const networkAsset = React.useMemo(() => {
    return makeNetworkAsset(txNetwork)
  }, [txNetwork])

  const {
    userVisibleTokensInfo,
    isLoading: isLoadingUserVisibleTokens
  } = useGetUserTokensRegistryQuery(undefined, {
    selectFromResult: result => ({
      ...result,
      userVisibleTokensInfo: selectAllUserAssetsFromQueryResult(result)
    })
  })

  const {
    data: accountInfosRegistry = accountInfoEntityAdaptorInitialState,
    isLoading: isLoadingAccountInfos
  } = useGetAccountInfosRegistryQuery(undefined)

  const account =
    accountInfosRegistry.entities[
      accountInfoEntityAdaptor.selectId({ address: transaction.fromAddress })
    ]

  // memos & computed from queries
  const combinedTokensList = React.useMemo(
    () => fullTokenList.concat(userVisibleTokensInfo),
    [fullTokenList, userVisibleTokensInfo]
  )

  const txToken = findTransactionToken(
    transaction,
    combinedTokensList
  )

  const recipientLabel = getAddressLabelFromRegistry(
    recipient,
    accountInfosRegistry
  )

  const senderLabel = getAddressLabelFromRegistry(
    transaction.fromAddress,
    accountInfosRegistry
  )

  const approvalTargetLabel = getAddressLabelFromRegistry(
    approvalTarget,
    accountInfosRegistry
  )

  const { buyToken, sellToken, buyAmount, sellAmount } = React.useMemo(() => {
    return getETHSwapTransactionBuyAndSellTokens({
      nativeAsset: makeNetworkAsset(txNetwork),
      tokensList: combinedTokensList,
      tx: transaction
    })
  }, [txNetwork, combinedTokensList, transaction])

  const txSymbol = getTransactionTokenSymbol({
    tx: transaction,
    txNetwork,
    token: txToken,
    sellToken
  })

  const normalizedTransferredValue = React.useMemo(() => {
    const { normalized } = getTransactionTransferredValue({
      tx: transaction,
      sellToken,
      token: txToken,
      txNetwork
    })
    return normalized.format(6)
  }, [
    transaction,
    sellToken,
    txToken,
    txNetwork
  ])

  const formattedSendCurrencyTotal = getTransactionFormattedSendCurrencyTotal({
    normalizedTransferredValue,
    tx: transaction,
    sellToken,
    token: txToken,
    txNetwork
  })

  // price queries
  const {
    fiatValue,
    isLoading: isLoadingTokenSpotPrice
  } = useGetTokenSpotPriceQuery({
    chainId: txToken?.chainId || '',
    contractAddress: txToken?.contractAddress || '',
    isErc721: txToken?.isErc721 || false,
    symbol: txToken?.symbol || '',
    tokenId: txToken?.tokenId || ''
  }, {
    skip: !txToken || !normalizedTransferredValue,
    // TODO: selector
    selectFromResult: (result) => {
      const price = result.data?.price || '0'
      const fiatValue = new Amount(normalizedTransferredValue)
        .times(price)
        .value?.toString() || '0'

      return {
        ...result,
        fiatValue
      }
    }
  })

  const {
    gasFeeFiat,
    isLoading: isLoadingGasAssetPrice
  } = useGetTokenSpotPriceQuery({
    chainId: networkAsset?.chainId || '',
    contractAddress: networkAsset?.contractAddress || '',
    isErc721: networkAsset?.isErc721 || false,
    symbol: networkAsset?.symbol || '',
    tokenId: networkAsset?.tokenId || ''
  },
  {
    skip: !networkAsset || !gasFee || !txNetwork,
    // TODO: selector
    selectFromResult: (res) => {
      const price = res.data?.price ?? '0'
      const gasFeeFiat = getGasFeeFiatValue({
        gasFee,
        networkSpotPrice: price,
        txNetwork
      })
      return ({
        ...res,
        gasFeeFiat
      })
    }
  })

  // state
  const [showTransactionPopup, setShowTransactionPopup] = React.useState<boolean>(false)

  // custom hooks
  const onClickViewOnBlockExplorer = useExplorer(txNetwork)

  // methods
  const onShowTransactionPopup = React.useCallback(() => {
    setShowTransactionPopup(true)
  }, [])

  const onHideTransactionPopup = React.useCallback(() => {
    if (showTransactionPopup) {
      setShowTransactionPopup(false)
    }
  }, [showTransactionPopup])

  const onClickCopyTransactionHash = React.useCallback(
    () => copyToClipboard(transaction.txHash),
    [transaction.txHash]
  )

  const onClickRetryTransaction = React.useCallback(
    () => {
      dispatch(WalletActions.retryTransaction({
        coinType: txCoinType,
        fromAddress: transaction.fromAddress,
        chainId: transaction.chainId,
        transactionId: transaction.id
      }))
    },
    [
      txCoinType,
      transaction.fromAddress,
      transaction.chainId,
      transaction.id
    ]
  )

  const onClickSpeedupTransaction = React.useCallback(
    () => {
      dispatch(WalletActions.speedupTransaction({
        coinType: txCoinType,
        fromAddress: transaction.fromAddress,
        chainId: transaction.chainId,
        transactionId: transaction.id
      }))
    },
    [
      txCoinType,
      transaction.fromAddress,
      transaction.chainId,
      transaction.id
    ]
  )

  const onClickCancelTransaction = React.useCallback(
    () => {
      dispatch(WalletActions.cancelTransaction({
        coinType: txCoinType,
        fromAddress: transaction.fromAddress,
        chainId: transaction.chainId,
        transactionId: transaction.id
      }))
    },
    [
      txCoinType,
      transaction.fromAddress,
      transaction.chainId,
      transaction.id
    ]
  )

  const onSelectAccount = React.useCallback((account: { address: string }) => {
    history.push(`${WalletRoutes.Accounts}/${account.address}`)
  }, [history])

  const onAddressClick = React.useCallback((address?: string) => () => {
    if (!address) {
      return
    }

    const account = accountInfosRegistry.entities[
      accountInfoEntityAdaptor.selectId({ address })
    ]

    if (account !== undefined) {
      onSelectAccount(account)
      return
    }

    onClickViewOnBlockExplorer('address', address)
  }, [onSelectAccount, accountInfosRegistry.entities, onClickViewOnBlockExplorer])

  const onSelectAsset = React.useCallback((asset: BraveWallet.BlockchainToken) => {
    if (asset.contractAddress === '') {
      history.push(
        `${WalletRoutes.PortfolioAssets //
        }/${asset.chainId //
        }/${asset.symbol}`
      )
      return
    }
    if (asset.isErc721 || asset.isNft || asset.isErc1155) {
      history.push(
        `${WalletRoutes.PortfolioNFTs //
        }/${asset.chainId //
        }/${asset.contractAddress //
        }/${asset.tokenId}`
      )
      return
    }
    history.push(
      `${WalletRoutes.PortfolioAssets //
      }/${asset.chainId //
      }/${asset.contractAddress}`
    )
  }, [history])

  const onAssetClick = React.useCallback(
    (symbol?: string, contractAddress?: string) =>
      isLoadingUserVisibleTokens
        ? undefined
        : () => {
            if (!symbol) {
              return
            }

            const asset = findTokenBySymbol(symbol, userVisibleTokensInfo)
            if (asset) {
              onSelectAsset(asset)
            }

            if (!contractAddress) {
              return
            }

            openBlockExplorerURL({
              type: 'token',
              network: txNetwork,
              value: contractAddress
            })()
          },
    [
      onSelectAsset,
      userVisibleTokensInfo,
      isLoadingUserVisibleTokens,
      txNetwork
    ]
  )

  // memos
  const fromOrb = React.useMemo(() => {
    return EthereumBlockies.create({
      seed: transaction.fromAddress.toLowerCase(),
      size: 8,
      scale: 16
    }).toDataURL()
  }, [transaction.fromAddress])

  const toOrb = React.useMemo(() => {
    return EthereumBlockies.create({
      seed: recipient.toLowerCase(),
      size: 8,
      scale: 16
    }).toDataURL()
  }, [recipient])

  const transactionIntentDescription = React.useMemo(() => {
    switch (true) {
      case transaction.txType === BraveWallet.TransactionType.ERC20Approve: {
        const text = getLocale(
          'braveWalletApprovalTransactionIntent'
        ).toLocaleUpperCase()
        return (
          <DetailRow>
            <DetailTextDark>
              <strong>{text}{' '}</strong>
              {getIsTxApprovalUnlimited(transaction)
                ? getLocale('braveWalletTransactionApproveUnlimited')
                : normalizedTransferredValue}{' '}
              <AddressOrAsset
                onClick={onAssetClick(txSymbol, txToken?.contractAddress)}
              >
                {txSymbol}
              </AddressOrAsset>{' '}
              -{' '}
              <AddressOrAsset onClick={onAddressClick(approvalTarget)}>
                {approvalTargetLabel}
              </AddressOrAsset>
            </DetailTextDark>
          </DetailRow>
        )
      }

      case transaction.txType === BraveWallet.TransactionType.ETHSwap: {
        return (
          <DetailRow>
            <DetailTextDark>
              {sellAmount?.format(6)}{' '}
              <AddressOrAsset
                onClick={onAssetClick(
                  sellToken?.symbol,
                  sellToken?.contractAddress
                )}
              >
                {sellToken?.symbol}
              </AddressOrAsset>
            </DetailTextDark>
            <ArrowIcon />
            <DetailTextDark>
              {buyAmount?.format(6)}{' '}
              <AddressOrAsset
                onClick={onAssetClick(
                  buyToken?.symbol,
                  buyToken?.contractAddress
                )}
              >
                {buyToken?.symbol}
              </AddressOrAsset>
            </DetailTextDark>
          </DetailRow>
        )
      }

      case transaction.txType !== BraveWallet.TransactionType.ETHSwap &&
        isSwap: {
        return (
          <DetailRow>
            <DetailTextDark>
              {normalizedTransferredValue}{' '}
              <AddressOrAsset
                onClick={onAssetClick(txSymbol, txToken?.contractAddress)}
              >
                {txSymbol}
              </AddressOrAsset>
            </DetailTextDark>
            <ArrowIcon />
            <DetailTextDark>
              <AddressOrAsset onClick={onAddressClick(recipient)}>
                {recipientLabel}
              </AddressOrAsset>
            </DetailTextDark>
          </DetailRow>
        )
      }

      case transaction.txType === BraveWallet.TransactionType.ETHSend:
      case transaction.txType === BraveWallet.TransactionType.ERC20Transfer:
      case transaction.txType ===
        BraveWallet.TransactionType.ERC721TransferFrom:
      case transaction.txType ===
        BraveWallet.TransactionType.ERC721SafeTransferFrom:
      default: {
        return (
          <DetailRow>
            <DetailTextDark>
              <AddressOrAsset onClick={onAddressClick(transaction.fromAddress)}>
                {senderLabel}
              </AddressOrAsset>
            </DetailTextDark>
            <ArrowIcon />
            <DetailTextDark>
              <AddressOrAsset onClick={onAddressClick(recipient)}>
                {recipientLabel}
              </AddressOrAsset>
            </DetailTextDark>
          </DetailRow>
        )
      }
    }
  }, [
    transaction,
    txToken?.contractAddress,
    isSwap,
    buyToken?.symbol,
    buyAmount,
    txSymbol,
    senderLabel,
    recipient,
    recipientLabel,
    normalizedTransferredValue,
    sellAmount,
    sellToken?.symbol,
    approvalTargetLabel,
    approvalTarget,
    onAssetClick,
    onAddressClick
  ])

  const transactionActionLocale = React.useMemo(() => {
    if (isSwap) {
      return <strong>
        {getLocale('braveWalletSwap').toLocaleUpperCase()}
      </strong>
    }

    if (transaction.txType === BraveWallet.TransactionType.ERC20Approve) {
      return (
        <>
          <strong>
            {getLocale(
              'braveWalletApprovalTransactionIntent'
            ).toLocaleUpperCase()}{' '}
          </strong>
          <AddressOrAsset
            onClick={onAssetClick(txSymbol, txToken?.contractAddress)}
          >
            {txSymbol}
          </AddressOrAsset>
        </>
      )
    }

    return (
      <>
        <strong>
          {getLocale('braveWalletTransactionSent').toLocaleUpperCase()}{' '}
        </strong>
        <AddressOrAsset
          // Disabled for ERC721 tokens until we have NFT meta data
          disabled={
            transaction.txType === BraveWallet.TransactionType.ERC721TransferFrom ||
            transaction.txType === BraveWallet.TransactionType.ERC721SafeTransferFrom
          }
          onClick={onAssetClick(txSymbol, txToken?.contractAddress)}
        >
          {txSymbol}
          {
            transaction.txType === BraveWallet.TransactionType.ERC721TransferFrom ||
              transaction.txType === BraveWallet.TransactionType.ERC721SafeTransferFrom
              ? ' ' + erc721TokenId
              : ''
          }
        </AddressOrAsset>
      </>
    )
  }, [transaction, displayAccountName, onAssetClick, txToken?.contractAddress])

  const wasTxRejected =
    transaction.txStatus !== BraveWallet.TransactionStatus.Rejected &&
    transaction.txStatus !== BraveWallet.TransactionStatus.Unapproved

  const formattedGasFeeFiatValue = React.useMemo(() => {
    return new Amount(gasFeeFiat).formatAsFiat(defaultFiatCurrency)
  }, [gasFeeFiat, defaultFiatCurrency])

  const formattedTransactionFiatValue = React.useMemo(() => {
    return new Amount(fiatValue).formatAsFiat(defaultFiatCurrency)
  }, [fiatValue, defaultFiatCurrency])

  // render
  return (
    <PortfolioTransactionItemWrapper
      ref={forwardedRef}
      isFocused={isFocused}
      onClick={onHideTransactionPopup}
    >
      <OrbAndTxDescriptionContainer>
        <OrbWrapper>
          <FromCircle orb={fromOrb} />
          <ToCircle orb={toOrb} />
        </OrbWrapper>

        <DetailColumn>
          <DetailRow>
            {/* Display account name only if rendered under Portfolio view */}
            {displayAccountName && account?.name && (
              <DetailTextLight>
                {isLoadingAccountInfos ? (
                  <Skeleton {...skeletonProps} />
                ) : (
                  account.name
                )}
              </DetailTextLight>
            )}

            <DetailTextDark>{transactionActionLocale}</DetailTextDark>
            <DetailTextLight>-</DetailTextLight>

            <TransactionTimestampTooltip
              text={
                <TransactionFeeTooltipBody>
                  {serializedTimeDeltaToJSDate(
                    transaction.createdTime
                  ).toUTCString()}
                </TransactionFeeTooltipBody>
              }
            >
              <DetailTextDarkBold>
                {formatDateAsRelative(
                  serializedTimeDeltaToJSDate(transaction.createdTime)
                )}
              </DetailTextDarkBold>
            </TransactionTimestampTooltip>
          </DetailRow>

          {transactionIntentDescription}
        </DetailColumn>
      </OrbAndTxDescriptionContainer>

      <StatusBalanceAndMoreContainer>
        <StatusRow>
          <StatusBubble status={transaction.txStatus} />
          <DetailTextDarkBold>
            {getTransactionStatusString(transaction.txStatus)}
          </DetailTextDarkBold>
        </StatusRow>

        {/* Balance & more */}
        <BalanceAndMoreRow>
          <BalanceColumn>
            {transaction.txType !==
              BraveWallet.TransactionType.ERC20Approve && (
              <>
                <DetailTextDark>
                  {/*
                    We need to return a Transaction Time Stamp
                    to calculate Fiat value here
                  */}
                  {isLoadingTokenSpotPrice || isLoadingDefaultFiatCurrency ? (
                    <Skeleton {...skeletonProps} />
                  ) : (
                    formattedTransactionFiatValue || 'NOT FOUND!'
                  )}
                </DetailTextDark>
                <DetailTextLight>{formattedSendCurrencyTotal}</DetailTextLight>
              </>
            )}
          </BalanceColumn>

          {/* Will remove this conditional for solana once https://github.com/brave/brave-browser/issues/22040 is implemented. */}
          {!isSolanaTx && !!txNetwork ? (
            <TransactionFeesTooltip
              text={
                <>
                  <TransactionFeeTooltipTitle>
                    {getLocale('braveWalletAllowSpendTransactionFee')}
                  </TransactionFeeTooltipTitle>
                  <TransactionFeeTooltipBody>
                    {isLoadingTxNetwork ? (
                      <Skeleton {...skeletonProps} />
                    ) : (
                      txNetwork &&
                      new Amount(gasFee)
                        .divideByDecimals(txNetwork.decimals)
                        .formatAsAsset(6, txNetwork.symbol)
                    )}
                  </TransactionFeeTooltipBody>
                  <TransactionFeeTooltipBody>
                    {isLoadingDefaultFiatCurrency || isLoadingGasAssetPrice ? (
                      <Skeleton {...skeletonProps} />
                    ) : (
                      formattedGasFeeFiatValue
                    )}
                  </TransactionFeeTooltipBody>
                </>
              }
            >
              <CoinsButton>
                <CoinsIcon />
              </CoinsButton>
            </TransactionFeesTooltip>
          ) : (
            <CoinsButtonSpacer />
          )}

          {wasTxRejected ? (
            <MoreButton onClick={onShowTransactionPopup}>
              <MoreIcon />
            </MoreButton>
          ) : (
            <RejectedTransactionSpacer />
          )}

          {showTransactionPopup && (
            <TransactionPopup>
              {[
                BraveWallet.TransactionStatus.Approved,
                BraveWallet.TransactionStatus.Submitted,
                BraveWallet.TransactionStatus.Confirmed,
                BraveWallet.TransactionStatus.Dropped
              ].includes(transaction.txStatus) && (
                <>
                  <TransactionPopupItem
                    onClick={onClickViewOnBlockExplorer(
                      'tx',
                      transaction.txHash
                    )}
                    text={getLocale('braveWalletTransactionExplorer')}
                  />
                  <TransactionPopupItem
                    onClick={onClickCopyTransactionHash}
                    text={getLocale('braveWalletTransactionCopyHash')}
                  />
                </>
              )}

              {[
                BraveWallet.TransactionStatus.Submitted,
                BraveWallet.TransactionStatus.Approved
              ].includes(transaction.txStatus) &&
                !isSolanaTx &&
                !isFilecoinTx && (
                  <>
                    <TransactionPopupItem
                      onClick={onClickSpeedupTransaction}
                      text={getLocale('braveWalletTransactionSpeedup')}
                    />
                    <TransactionPopupItem
                      onClick={onClickCancelTransaction}
                      text={getLocale('braveWalletTransactionCancel')}
                    />
                  </>
                )}

              {BraveWallet.TransactionStatus.Error === transaction.txStatus &&
                !isSolanaTx &&
                !isFilecoinTx && (
                  <TransactionPopupItem
                    onClick={onClickRetryTransaction}
                    text={getLocale('braveWalletTransactionRetry')}
                  />
                )}
            </TransactionPopup>
          )}
        </BalanceAndMoreRow>
      </StatusBalanceAndMoreContainer>
    </PortfolioTransactionItemWrapper>
  )
}
)

export default PortfolioTransactionItem
