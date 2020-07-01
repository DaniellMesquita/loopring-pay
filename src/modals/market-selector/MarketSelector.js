import { ConfigProvider, List, Radio } from "antd";
import { SearchInput } from "styles/Styles";
import { connect } from "react-redux";
import { debounce } from "lodash";
import { getTicker } from "lightcone/api/LightconeAPI";
import { history } from "redux/configureStore";
import { withUserPreferences } from "components/UserPreferenceContext";
import I from "components/I";
import React from "react";
import config from "lightcone/config";
import styled, { withTheme } from "styled-components";

import { emptyOrderBooks } from "redux/actions/market/OrderBook";
import { getEtherscanLink } from "lightcone/api/localStorgeAPI";
import { sortAndCheckNewMarkets } from "./utils";
import ColumnWrapper from "./components/ColumnWrapper";
import EmptyTableIndicator from "components/EmptyTableIndicator";

const AssetIcon = styled.a`
  display: inline-block;
  width: 50px;
  height: 32px;
  border-radius: 50%;
  margin-right: 16px;
  margin-left: -8px;
  margin-top: 0px;
  background-repeat: no-repeat;
  background-size: 33px;
  background-position: center;
  background-origin: content-box;
`;

const ListItem = styled(List.Item)`
  background: ${(props) => props.theme.background}!important;
  border-top: none !important;
  margin-bottom: 8px !important;
  height: 60px !important;
  border-radius: 4px;
  cursor: pointer;
  border-left: 5px solid transparent !important;
  transition: 0.75s !important;
  &:hover {
    border-left-color: ${(props) => props.theme.primary}!important;
  }
`;

const RadioButton = styled(Radio.Button)`
  width: 25%;
  text-align: center;
`;

class MarketSelector extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      filter: "",
      groupSelect: "all",
      tickers: [],
    };
  }

  componentDidMount() {
    this.loadData();
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.props.isVisible !== false &&
      this.props.isVisible !== prevProps.isVisible
    ) {
      this.loadData();
    }

    if (
      prevProps.exchange.isInitialized !== this.props.exchange.isInitialized &&
      this.props.isVisible
    ) {
      this.loadData();
    }
  }

  loadData = debounce(() => {
    (async () => {
      try {
        const tickers = await getTicker(
          this.props.exchange.markets
            .filter((m) => m.enabled)
            .map((m) => m.market),
          this.props.exchange.tokens
        );
        this.setState({
          tickers,
        });
      } catch (error) {}
    })();
  }, 500);

  getAssetUrl(token, exchangeAddress) {
    var addr = window.wallet ? window.wallet.address : exchangeAddress;
    if (token.symbol === "ETH")
      return `${getEtherscanLink(this.props.exchange.chainId)}/address/${addr}`;
    else
      return `${getEtherscanLink(this.props.exchange.chainId)}/token/${
        token.address
      }?a=${addr}`;
  }

  getAssetIconUrl(token) {
    const { theme } = this.props;
    var path;
    if (token.symbol === "ETH") {
      return "url(assets/images/ETH.png)";
    } else if (token.symbol === "LRC") {
      return "url(assets/images/LRC.png)";
    } else if (token.symbol === "KEEP") {
      return `url("assets/images/${theme.imgDir}/KEEP.png")`;
    } else if (token.symbol.toUpperCase() === "TBTC") {
      return `url("assets/images/TBTC.png")`;
    } else {
      return "url(assets/images/ETH.png)";
    }
  }

  onSearchInputChange = (e) => {
    this.setState({
      filter: e.target.value,
    });
  };

  onGroupSelectChange = (e) => {
    this.setState({
      groupSelect: e.target.value,
    });
  };

  clickedMarketItem = (updatedMarket) => {
    if (
      this.props.market.currentMarket.current.toUpperCase() !==
      updatedMarket.market.toUpperCase()
    ) {
      history.push("/trade/" + updatedMarket.market.toUpperCase());
      // Empty orderbooks
      this.props.emptyOrderBooks(0);
      this.props.closePopover();
    }
  };

  render() {
    const userPreferences = this.props.userPreferences;
    const language = userPreferences.language;
    let placeholder = language === "en" ? "Search market" : "搜索市场对";

    const { filter, groupSelect } = this.state;
    const { theme } = this.props;
    let markets =
      filter !== ""
        ? this.props.exchange.markets.filter(
            (x) => x.market.includes(filter.toUpperCase()) && x.enabled
          )
        : this.props.exchange.markets.filter((x) => x.enabled);

    if (groupSelect !== "all") {
      markets = markets.filter((x) =>
        x.market.includes(groupSelect.toUpperCase())
      );
    }

    markets = sortAndCheckNewMarkets(markets);

    let updatedMarkets = [];
    for (let i = 0; i < markets.length; i = i + 1) {
      const market = markets[i];
      const tickers = this.state.tickers.filter(
        (x) => x.market === market.market
      );

      let updatedMarket = {
        ...market,
        baseToken: config.getTokenBySymbol(
          market.market.split("-")[0],
          this.props.exchange.tokens
        ),
        quoteToken: config.getTokenBySymbol(
          market.market.split("-")[1],
          this.props.exchange.tokens
        ),
      };
      if (tickers.length === 1) {
        updatedMarket["ticker"] = tickers[0];
      } else {
        updatedMarket["ticker"] = {
          percentChange24h: "-",
          volume: "-",
          close: "-",
        };
      }
      updatedMarkets.push(updatedMarket);
    }

    const customizeRenderEmpty = () => (
      <EmptyTableIndicator text={"NoMarketSelects"} loading={false} />
    );

    return (
      <div
        style={{
          width: "400px",
        }}
      >
        <Radio.Group
          style={{
            width: "100%",
            paddingTop: "8px",
            paddingBottom: "8px",
          }}
          onChange={this.onGroupSelectChange}
          defaultValue="all"
        >
          <RadioButton value="all">ALL</RadioButton>
          <RadioButton value="lrc">LRC</RadioButton>
          <RadioButton value="eth">ETH</RadioButton>
          <RadioButton value="usdt">USDT</RadioButton>
        </Radio.Group>

        <SearchInput
          style={{
            margin: "4px 0",
            width: "140px",
            height: "30px !important",
            fontSize: "0.9rem !important",
          }}
          placeholder={placeholder}
          onChange={this.onSearchInputChange}
        />
        <div
          style={{
            paddingTop: "8px",
            maxHeight: "calc(100vh - 230px)",
            overflowY: "scroll",
          }}
        >
          <ConfigProvider
            renderEmpty={updatedMarkets.length === 0 && customizeRenderEmpty}
          >
            <List
              bordered
              dataSource={updatedMarkets}
              renderItem={(updatedMarket) => (
                <div
                  onClick={() => {
                    this.clickedMarketItem(updatedMarket);
                  }}
                >
                  <ListItem>
                    <AssetIcon
                      href={this.getAssetUrl(
                        updatedMarket.baseToken,
                        this.props.exchange.exchangeAddress
                      )}
                      target="_blank"
                      style={{
                        backgroundImage: this.getAssetIconUrl(
                          updatedMarket.baseToken
                        ),
                      }}
                    />

                    <span
                      style={{
                        width: "20%",
                        minWidth: "120px",
                      }}
                    >
                      <ColumnWrapper
                        textAlign="left"
                        isNew={updatedMarket.isNew}
                        row1={updatedMarket.market}
                        row2={<I s={updatedMarket.baseToken.name} />}
                      />
                    </span>
                    <span
                      style={{
                        width: "46%",
                        marginRight: "4%",
                      }}
                    >
                      <ColumnWrapper
                        textAlign="right"
                        row1={`${updatedMarket.ticker.volume} ${updatedMarket.quoteToken.symbol}`}
                        row2={<I s="24h Volume" />}
                      />
                    </span>
                    <span
                      style={{
                        width: "30%",
                      }}
                    >
                      <ColumnWrapper
                        textAlign="right"
                        row1={
                          updatedMarket.ticker.close
                            ? updatedMarket.ticker.close
                            : "-"
                        }
                        row2={`${updatedMarket.ticker.percentChange24h}%`}
                        row2Color={
                          updatedMarket.ticker.percentChange24h &&
                          updatedMarket.ticker.percentChange24h.startsWith("-")
                            ? theme.downColor
                            : theme.upColor
                        }
                      />
                    </span>
                  </ListItem>
                </div>
              )}
            />
          </ConfigProvider>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  const { market, exchange } = state;

  return {
    market,
    exchange,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    emptyOrderBooks: (level) => dispatch(emptyOrderBooks(level)),
  };
};

export default withUserPreferences(
  withTheme(connect(mapStateToProps, mapDispatchToProps)(MarketSelector))
);
