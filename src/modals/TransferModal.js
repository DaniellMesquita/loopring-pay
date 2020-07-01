import { ActionButton, AssetDropdownMenuItem } from "styles/Styles";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Instruction,
  MyModal,
  Section,
  TextPopupTitle,
} from 'modals/styles/Styles';

import { Col, Input, Row, Spin } from 'antd';
import { connect } from 'react-redux';
import { debounce } from 'lodash';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faTwitter } from '@fortawesome/free-brands-svg-icons/faTwitter';

import { formatter } from 'lightcone/common';
import { getWalletType } from 'lightcone/api/localStorgeAPI';
import { isValidAddress } from 'ethereumjs-util';
import { lightconeGetAccount } from 'lightcone/api/LightconeAPI';
import { notifyError, notifySuccess } from 'redux/actions/Notification';
import { showTransferModal } from 'redux/actions/ModalManager';
import { withUserPreferences } from 'components/UserPreferenceContext';
import AppLayout from 'AppLayout';
import AssetDropdown from 'modals/components/AssetDropdown';
import ErrorMessage from 'modals/components/ErrorMessage';
import Group from 'modals/components/Group';
import I from 'components/I';
import LabelValue from 'modals/components/LabelValue';
import ModalIndicator from 'modals/components/ModalIndicator';
import NumericInput from 'components/NumericInput';
import React from 'react';
import WalletConnectIndicator from 'modals/components/WalletConnectIndicator';
import WalletConnectIndicatorPlaceholder from 'modals/components/WalletConnectIndicatorPlaceholder';
import WhyIcon from 'components/WhyIcon';
import styled, { withTheme } from 'styled-components';

import config from 'lightcone/config';

import './TransferModal.less';
import { CopyToClipboard } from 'react-copy-to-clipboard';
// import { Share } from 'react-twitter-widgets';
import { fetchTransfers } from "redux/actions/MyAccountPage";
import { submitTransfer } from "lightcone/api/v1/transfer";

const { Search } = Input;

const SearchStyled = styled(Search)`
  .ant-input-suffix {
    display: table;
    height: 100%;

    .ant-input-search-icon {
      display: ${(props) => (props.loading ? "table-cell" : "none")};
      vertical-align: middle;
      color: ${(props) => props.theme.textDim};
    }
  }
`;

class TransferModal extends React.Component {
  state = {
    loading: false,
    amount: null,
    amountF: null,
    addressValue: "",
    addressLoading: false,
    toAddress: "",
    receiver: null,
    validateAddress: true,
    nonce: -1,
    validateAmount: true,
    availableAmount: 0,
    errorMessage1: '',
    errorToken: '',
    errorMessage2: '',
    errorAddressMessage: '',
    memo: '',
  };

  componentDidUpdate(prevProps, prevState) {
    // When the modal becomes visible
    if (
      (this.props.isVisible !== prevProps.isVisible ||
        this.props.dexAccount.account.address !==
          prevProps.dexAccount.account.address) &&
      this.props.isVisible &&
      window.wallet
    ) {
      const selectedTokenSymbol = this.props.modalManager.transferToken;
      this.loadData(selectedTokenSymbol);
    }

    if (
      this.props.isVisible === false &&
      this.props.isVisible !== prevProps.isVisible
    ) {
      this.setState({
        loading: false,
        amount: null,
        amountF: null,
        toAddress: "",
        receiver: null,
        addressValue: "",
        addressLoading: false,
        validateAddress: true,
        nonce: -1,
        validateAmount: true,
        availableAmount: 0,
        errorMessage1: '',
        errorToken: '',
        errorMessage2: '',
        errorAddressMessage: '',
        memo: '',
      });
    }
  }

  handleCurrencyTypeSelect = (tokenSymbol) => {
    this.props.showTransferModal(tokenSymbol);
    this.loadData(tokenSymbol);

    // Reset amount and error message
    this.setState({
      amount: null,
      validateAmount: true,
    });
  };

  loadData(tokenSymbol) {
    (async () => {
      try {
        const { balances } = this.props.balances;
        const tokenBalance = this.getAvailableAmount(tokenSymbol, balances);
        const amountF = this.getFee(tokenSymbol);
        let validateAmount = !this.state.amount;
        if (!validateAmount) {
          validateAmount =
            Number(this.state.amount) + Number(amountF) <= tokenBalance;
        }

        const { accountNonce } = await lightconeGetAccount(
          window.wallet.address
        );

        this.setState({
          availableAmount: tokenBalance,
          validateAmount,
          amountF,
          nonce: accountNonce,
        });
      } catch (error) {}
    })();
  }

  getFee = (tokenSymbol) => {
    const { tokens, transferFees } = this.props.exchange;
    if (transferFees) {
      const fee = transferFees.find(
        (f) => f.token.toUpperCase() === tokenSymbol.toUpperCase()
      ).fee;
      return config.fromWEI(tokenSymbol, fee, tokens);
    } else {
      return "0";
    }
  };

  getAvailableAmount = (symbol, balances) => {
    const tokens = this.props.exchange.tokens;
    const selectedToken = config.getTokenBySymbol(symbol, tokens);
    const holdBalance = balances.find(
      (ba) => ba.tokenId === selectedToken.tokenId
    );
    return holdBalance
      ? config.fromWEI(
          selectedToken.symbol,
          formatter
            .toBig(holdBalance.totalAmount)
            .minus(holdBalance.frozenAmount),
          tokens
        )
      : config.fromWEI(selectedToken.symbol, 0, tokens);
  };

  onAmountValueChange = (value) => {
    const selectedTokenSymbol = this.props.modalManager.transferToken;
    // Check validateAmount
    let validateAmount;
    if (Number.isNaN(Number(value)) || Number(value) <= 0) {
      validateAmount = false;
    } else {
      validateAmount = !value;
      if (!validateAmount) {
        validateAmount =
          Number(value) + Number(this.state.amountF) <=
          this.state.availableAmount;
      }
    }

    // Check amount decimal points
    let errorMessage1 = "";
    let errorToken = "";
    let errorMessage2 = "";

    const { tokens } = this.props.exchange;
    const token = config.getTokenBySymbol(selectedTokenSymbol, tokens);

    if (token.symbol && validateAmount && value.split(".").length === 2) {
      var inputPrecision = value.split(".")[1].length;
      if (
        inputPrecision > token.decimals ||
        (parseFloat(value) === 0 && inputPrecision === token.decimals)
      ) {
        errorMessage1 = "Maximum_amount_input_decimal_part_1";
        errorToken = `${token.decimals}`;
        errorMessage2 = "Maximum_input_decimal_part_2";
        validateAmount = false;
      }
    }

    this.setState({
      amount: value,
      validateAmount,
      errorMessage1,
      errorToken,
      errorMessage2,
    });
  };

  validateAmount = () => {
    const { amount, availableAmount } = this.state;
    if (
      amount &&
      parseFloat(amount) > 0 &&
      parseFloat(amount) <= availableAmount
    ) {
      return true;
    } else {
      return false;
    }
  };

  submitTransfer = () => {
    this.setState({
      loading: true,
    });

    let { amount, amountF, receiver, nonce, memo } = this.state;
    const { tokens, exchangeId } = this.props.exchange;
    // Transfer
    let symbol = this.props.modalManager.transferToken;

    // const referralLink = `loopring.io/invite/${this.props.dexAccount.account.accountId}`;
    // Need to use Share to generate link if there is an update.
    const twitterLink = `https://twitter.com/intent/tweet?ref_src=twsrc%5Etfw&text=I%20just%20made%20a%20layer-2%20transfer%20on%20Ethereum%20using%20the%20newly%20launched%20Loopring%20Pay.%20It%20was%20instant%2C%20free%2C%20and%20completely%20self-custodial%20thanks%20to%20Loopring%27s%20zkRollup.%20%23EthereumScalesToday%20%23LoopringPay%20Get%20in%20the%20fast%20lane%20at%20loopring.io&tw_p=tweetbutton`;

    (async () => {
      try {
        if (nonce === -1) {
          const { accountNonce } = await lightconeGetAccount(
            window.wallet.address
          );

          nonce = accountNonce;
        }

        const { transfer, ecdsaSig } = await window.wallet.signTransfer(
          {
            exchangeId,
            receiver: receiver,
            token: symbol,
            amount,
            tokenF: symbol,
            amountF,
            nonce,
            label: config.getLabel(),
            memo,
          },
          tokens
        );

        await submitTransfer(
          transfer,
          ecdsaSig,
          this.props.dexAccount.account.apiKey
        );

        let message;
        if (this.props.userPreferences.language === "zh") {
          message = <I s="TransferInstructionNotification" />;
        } else {
          message = (
            <div>
              <div>
                <I s="TransferInstructionNotification" />
              </div>

              <Row
                style={{
                  marginTop: "3px",
                }}
                gutter={6}
              >
                <Col>
                  <I s="Share on" />
                </Col>
                <Col>
                  <a
                    className="btn-twitter"
                    onClick={() => {
                      window.open(
                        twitterLink,
                        "newwindow",
                        "width=720,height=480"
                      );
                    }}
                  >
                    <FontAwesomeIcon
                      style={{
                        paddingTop: "1px",
                      }}
                      icon={faTwitter}
                    />{" "}
                    Twitter
                  </a>
                  {/* <Share
                    options={{
                      text: `I just made a layer-2 transfer on Ethereum using the newly launched Loopring Pay. It was instant, free, and completely self-custodial thanks to Loopring's zkRollup. #EthereumScalesToday #LoopringPay Get in the fast lane at loopring.io`,
                    }}
                  /> */}
                </Col>
              </Row>
            </div>
          );
        }

        notifySuccess(message, this.props.theme, 20);
      } catch (err) {
        console.error("transfer failed", err);
        notifyError(
          <I s="TransferInstructionNotificationFailed" />,
          this.props.theme
        );
      } finally {
        this.getTransferHistory();
        this.props.closeModal();
        const { accountNonce } = await lightconeGetAccount(
          window.wallet.address
        );
        this.setState({
          loading: false,
          amount: null,
          nonce: accountNonce,
        });
      }
    })();
  };

  onClose = () => {
    this.props.closeModal();
  };

  getTransferHistory = () => {
    const { dexAccount, exchange, balances, fetchTransfers } = this.props;

    let tokenSymbol;
    if (balances.tokenFilter !== "All") {
      tokenSymbol = balances.tokenFilter;
    }
    fetchTransfers(
      balances.transferLimit,
      balances.transferOffset,
      dexAccount.account.accountId,
      tokenSymbol,
      dexAccount.account.apiKey,
      exchange.tokens
    );
  };

  onClick = () => {
    if (this.validateAmount() === false) {
      this.setState({
        validateAmount: false,
      });
      return;
    } else {
      this.setState({
        validateAmount: true,
      });
    }

    this.submitTransfer();
  };

  enterAmount = (e) => {
    if (e.keyCode === 13) {
      e.preventDefault();
      this.onClick();
    }
  };

  onToAddressChange = async (e) => {
    const value = e.target.value;
    // Update the search UI
    this.setState({
      addressValue: value,
    });

    // Verify the search input value
    this.onToAddressChangeLoadData(value);
  };

  onToAddressChangeLoadData = debounce((value) => {
    (async () => {
      let address = value;
      // Check ENS
      if (value.toLowerCase().match(/\.(eth|xyz)$/g)) {
        this.setState({
          addressLoading: true,
        });
        try {
          await window.wallet.web3.eth.ens
            .getAddress(value)
            .then(function (addr) {
              address = addr;
            });
        } catch (e) {}
        this.setState({
          addressLoading: false,
        });
      }

      let validateAddress = !!address && isValidAddress(address);
      if (validateAddress) {
        try {
          const receiver = (await lightconeGetAccount(address)).accountId;
          if (receiver !== window.wallet.accountId) {
            this.setState({
              addressValue: value,
              toAddress: address,
              receiver,
              validateAddress,
              errorAddressMessage: '',
            });
          } else {
            this.setState({
              addressValue: value,
              toAddress: address,
              receiver,
              validateAddress: false,
              errorAddressMessage: 'Sender and receiver are the same',
            });
          }
        } catch (err) {
          this.setState({
            addressValue: value,
            toAddress: address,
            validateAddress: false,
            errorAddressMessage:
              'The recipient doesn’t have a Loopring account',
          });
        }
      } else {
        this.setState({
          addressValue: value,
          toAddress: '',
          validateAddress: false,
          errorAddressMessage: 'Invalid recipient address',
        });
      }
    })();
  }, 500);

  transferAll = () => {
    const { availableAmount, amountF } = this.state;
    const amount = parseFloat(availableAmount) - parseFloat(amountF);

    this.setState({
      amount: Math.max(0, amount),
      validateAmount: amount > 0,
      errorMessage1: "",
      errorToken: "",
      errorMessage2: "",
    });
  };

  onMemoChange = (e) => {
    if (e.target.value.length <= 128) {
      this.setState({
        memo: e.target.value,
      });
    }
  };

  clickedCopyReferralLink = () => {
    notifySuccess(<I s="CopyReferralLink" />, this.props.theme);
  };

  render() {
    const theme = this.props.theme;

    const { availableAmount } = this.state;
    const { tokens } = this.props.exchange;

    const selectedTokenSymbol = this.props.modalManager.transferToken;
    const { balances } = this.props.balances;
    const selectedToken = config.getTokenBySymbol(selectedTokenSymbol, tokens);
    const holdBalance = balances.find(
      (ba) => ba.tokenId === selectedToken.tokenId
    );

    // String type with correct precision
    const holdAmount = holdBalance
      ? config.fromWEI(
          selectedToken.symbol,
          formatter
            .toBig(holdBalance.totalAmount)
            .minus(holdBalance.frozenAmount),
          tokens
        )
      : config.fromWEI(selectedToken.symbol, 0, tokens);

    const options = tokens
      .filter((token) => token.enabled)
      .map((token, i) => {
        const option = {};
        option.key = token.symbol;
        option.text = token.symbol + " - " + token.name;

        const menuItem = (
          <AssetDropdownMenuItem
            key={i}
            onClick={() => {
              this.handleCurrencyTypeSelect(token.symbol);
            }}
          >
            <span>
              {token.symbol} - <I s={token.name} />
            </span>
          </AssetDropdownMenuItem>
        );

        return menuItem;
      });

    const tipIcons = [];
    const tips = [];
    tipIcons.push(
      <div key="0">
        <FontAwesomeIcon
          icon={faClock}
          style={{
            visibility: "hidden",
          }}
        />
      </div>
    );
    tips.push(
      <I
        s={
          getWalletType() === "MetaMask"
            ? "metaMaskPendingTxTip"
            : "walletConnectPendingTxTip"
        }
      />
    );

    let indicator;
    if (tips.length === 1 && getWalletType() !== "MetaMask") {
      indicator = <WalletConnectIndicator />;
    } else {
      indicator = (
        <ModalIndicator
          title={
            getWalletType() === "MetaMask"
              ? "metamaskConfirm"
              : "walletConnectConfirm"
          }
          tipIcons={tipIcons}
          tips={tips}
          imageUrl={
            getWalletType() === "MetaMask"
              ? `assets/images/${theme.imgDir}/metamask_pending.png`
              : ``
          }
          marginTop="80px"
        />
      );
    }

    let isWalletConnectLoading =
      this.state.loading && tips.length === 1 && getWalletType() !== "MetaMask";

    let referralLink;
    if (
      this.props.dexAccount.account &&
      this.props.dexAccount.account.accountId
    ) {
      referralLink = `${window.location.host}/invite/${this.props.dexAccount.account.accountId}`;
    } else {
      referralLink = "";
    }

    return (
      <MyModal
        centered
        width="100%"
        title={null}
        footer={null}
        maskClosable={false}
        closable={false}
        visible={this.props.isVisible}
        onCancel={() => this.onClose()}
        bodyStyle={{
          padding: "0"
        }}
      >
        <Spin spinning={this.state.loading} indicator={indicator}>
          <WalletConnectIndicatorPlaceholder
            isWalletConnectLoading={isWalletConnectLoading}
          />
          <div className="modal-dialog modal-dialog-vertical" role="document">
            <div className="modal-content">
              <div className="modal-body p-lg-0">
                <div className="d-inline-block w-lg-60 vh-100">
                  <button className="btn btn-link text-dark position-absolute mt-n4 ml-n4 ml-lg-0 mt-lg-0" type="button" name="button" data-dismiss="modal" aria-label="Close" onClick={() => this.onClose()}>
                    <i className="fe fe-arrow-left h2"></i>
                  </button>
                  <div className="row justify-content-center">
                    <div className="col col-lg-8">
                      <h1 className="display-4 text-center my-5">
                        Send money faster and for free
                      </h1>

                      <div className="card mb-5" style={{display: isWalletConnectLoading ? "none" : "block",}}>
                        <div className="card-body">
                          <div className="form-group">
                          <Group label={<I s="Asset" />}>
                            <AssetDropdown
                              options={options}
                              selected={
                                <span>
                                  {selectedToken.symbol} - <I s={selectedToken.name} />
                                </span>
                              }
                            />
                          </Group>
                          <Group label={<I s="Recipient Ethereum Address/ENS Name" />}>
                              <SearchStyled
                                suffix={<span key="search_suffix" />}
                                style={{
                                  color: theme.dark,
                                }}
                                value={this.state.addressValue}
                                onChange={this.onToAddressChange}
                                loading={this.state.addressLoading}
                                disabled={this.state.addressLoading}
                              />
                              {this.state.addressValue.toLowerCase().match(/\.(eth|xyz)$/g) &&
                                !!this.state.toAddress && (
                                  <div
                                    style={{
                                      paddingTop: "12px",
                                    }}
                                  >
                                    {" "}
                                    <I s="Ethereum Address" />: {this.state.toAddress}
                                  </div>
                                )}
                              <ErrorMessage
                                isTransfer={true}
                                selectedToken={selectedToken}
                                amount={this.state.amount}
                                availableAmount={availableAmount}
                                validateAmount={this.state.validateAmount}
                                errorMessage1={this.state.errorMessage1}
                                errorToken={this.state.errorToken}
                                errorMessage2={this.state.errorMessage2}
                                validateAddress={this.state.validateAddress}
                                errorAddressMessage={this.state.errorAddressMessage}
                              />
                            </Group>
                            <Group label={<I s="Amount" />}>
                              <NumericInput
                                decimals={selectedToken.precision}
                                color={
                                  this.state.validateAmount
                                    ? theme.textWhite
                                    : theme.sellPrimary
                                }
                                value={this.state.amount}
                                onChange={this.onAmountValueChange}
                                onClick={this.onAmountValueClick}
                                suffix={selectedTokenSymbol.toUpperCase()}
                                onKeyDown={this.enterAmount.bind(this)}
                              />
                              <ErrorMessage
                                isTransfer={true}
                                selectedToken={selectedToken}
                                ethEnough={true}
                                amount={this.state.amount}
                                availableAmount={availableAmount}
                                validateAmount={this.state.validateAmount}
                                errorMessage1={this.state.errorMessage1}
                                errorToken={this.state.errorToken}
                                errorMessage2={this.state.errorMessage2}
                              />
                            </Group>
                            <Group label={<I s="Memo" />}>
                              <SearchStyled
                                color={theme.textWhite}
                                value={this.state.memo}
                                onChange={this.onMemoChange}
                              />
                            </Group>

                            <LabelValue
                              label={<I s="Balance on Loopring" />}
                              value={holdAmount}
                              unit={selectedTokenSymbol.toUpperCase()}
                              onClick={() => this.transferAll()}
                            />

                          <Section
                            style={{
                              display: isWalletConnectLoading ? "none" : "block",
                            }}
                          >
                            <button 
                            type="button"
                            name="Send money"
                            className="btn btn-primary btn-lg btn-block mt-4"
                            disabled={
                              this.state.amount <= 0 ||
                              !this.state.validateAmount ||
                              this.state.loading ||
                              !this.state.validateAddress
                            }
                            onClick={() => this.onClick()}
                            >
                              Send money
                            </button>
                          </Section>
                          </div>

                        </div>
                      </div>
                      
                      <div className="d-block d-lg-none">
                        <h5 className="header-pretitle mb-4 text-secondary">Everyday benefits</h5>
                        <div className="row mb-4">
                          <div className="col-auto">

                            <div className="btn btn-rounded-circle badge-soft-primary">
                              ⚔️
                            </div>

                          </div>
                          <div className="col ml-n2">
                            <h2 className="card-title mb-2">
                              Secure
                            </h2>

                            <p className="card-text mb-1">
                              Like on Ethereum, enjoy 100% non-custodial transactions.
                            </p>

                          </div>
                        </div>
                        <div className="row mb-4">
                          <div className="col-auto">

                            <div className="btn btn-rounded-circle badge-soft-primary">
                              ⚡️
                            </div>

                          </div>
                          <div className="col ml-n2">
                            <h2 className="card-title mb-2">
                              Fast
                            </h2>

                            <p className="card-text mb-1">
                              No more waiting, your transactions are lightning fast.
                            </p>

                          </div>
                        </div>
                        <div className="row mb-6">
                          <div className="col-auto">

                            <div className="btn btn-rounded-circle badge-soft-primary">
                              💰
                            </div>

                          </div>
                          <div className="col ml-n2">
                            <h2 className="card-title mb-2">
                              Free
                            </h2>

                            <p className="card-text mb-1">
                              A transaction on Loopring Pay is completly free and doesn't require to pay gas fees.
                            </p>

                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-lg-inline-block w-lg-40 position-fixed d-none bg-primary">
                  <div className="vh-100 p-4">
                    <div className="row justify-content-center">
                      <div className="col-10">
                        <img className="img-fluid mb-4" src="assets/images/logo.svg" alt="" width="64"/>
                        <h5 className="header-pretitle text-white mb-4">Everyday benefits</h5>
                        <div className="row mb-4">
                          <div className="col-auto">

                            <div className="btn btn-rounded-circle badge-soft-primary">
                              ⚔️
                            </div>

                          </div>
                          <div className="col ml-n2">
                            <h2 className="card-title mb-2 text-white">
                              Secure
                            </h2>

                            <p className="card-text text-white mb-1">
                              Like on Ethereum, enjoy 100% non-custodial transactions.
                            </p>

                          </div>
                        </div>
                        <div className="row mb-4">
                          <div className="col-auto">

                            <div className="btn btn-rounded-circle badge-soft-primary">
                              ⚡️
                            </div>

                          </div>
                          <div className="col ml-n2">
                            <h2 className="card-title mb-2 text-white">
                              Fast
                            </h2>

                            <p className="card-text text-white mb-1">
                              No more waiting, your transactions are lightning fast.
                            </p>

                          </div>
                        </div>
                        <div className="row mb-4">
                          <div className="col-auto">

                            <div className="btn btn-rounded-circle badge-soft-primary">
                              💰
                            </div>

                          </div>
                          <div className="col ml-n2">
                            <h2 className="card-title mb-2 text-white">
                              Free
                            </h2>

                            <p className="card-text text-white mb-1">
                              A transaction on Loopring Pay is completly free and doesn't require to pay gas fees.
                            </p>

                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              </div> 
            </div>
          </div>
        </Spin>
      </MyModal>
     );
  }
}

const mapStateToProps = (state) => {
  const { modalManager, dexAccount, balances, exchange } = state;

  const isVisible = modalManager.isTransferModalVisible;
  return {
    isVisible,
    modalManager,
    dexAccount,
    balances,
    exchange,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    closeModal: () => dispatch(showTransferModal(false, "")),
    showTransferModal: (token) => dispatch(showTransferModal(true, token)),
    fetchTransfers: (limit, offset, accountId, tokenSymbol, apiKey, tokens) =>
      dispatch(
        fetchTransfers(limit, offset, accountId, tokenSymbol, apiKey, tokens)
      ),
  };
};

export default withUserPreferences(
  withTheme(connect(mapStateToProps, mapDispatchToProps)(TransferModal))
);
