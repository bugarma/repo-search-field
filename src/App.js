import React, { PureComponent } from 'react';
import TextField from "@material-ui/core/TextField";
import styled from "styled-components";
import axios from "axios";
import CircularProgress from '@material-ui/core/CircularProgress';
import Button from "@material-ui/core/Button";

import { parseLinkHeader } from "./utils";
import Table from './Table';

const Wrapper = styled.div`
  width: 100%;

  .input-field {
    margin: auto;
    width: 80%;
    display: flex;
    margin-top: 20px;
  }
`;


class App extends PureComponent {
  state = {
    q: '',
    loading: false,
    repos: [],
  }

  // 設定 timer 避免輸入時，短時間大量 request
  handleChange = (event) => {
    const { value } = event.target;

    // clear timeout & cancel request
    if(this.timer) {
      clearTimeout(this.timer);
    }
    if(this.source) {
      this.source.cancel();
    }

    this.setState({
      q: value,
      loading: false,
      repos: [],
      error: null,
      nextPage: null,
    })

    // no need to send request if field is empty
    if(value === '') return;

    this.setState({
      loading: true,
    })
    this.timer = setTimeout(async () => {
      const url = `https://api.github.com/search/repositories?q=${value}`;
      this.source = axios.CancelToken.source();
      try {

        const response = await axios.get(url, {
          cancelToken: this.source.token,
        });

        const linkString = response.headers.link;
        this.setState({
          repos: response.data.items,
          loading: false,
          nextPage: linkString? parseLinkHeader(linkString).next : null,
        });
      } catch(error) {
        this.handleRequestError(error);
      }
    }, 500);
  }

  handleLoadMore = async () => {
    const { loading, nextPage, error } = this.state;
    // return if loading, hasNoMore, error
    if(loading || !nextPage || error) return;
    
    this.setState({
      loading: true,
    })
    try {
      const response = await axios.get(nextPage);
      const linkString = response.headers.link;
      const link = parseLinkHeader(linkString);
      this.setState(prev => ({
        loading: false,
        repos: [...prev.repos, ...response.data.items],
        nextPage: link.next
      }))
    } catch (err) {
      this.handleRequestError(err);
    }
  }

  handleRequestError = (error) => {
    if(axios.isCancel(error)) return;
    const { response } = error;
    if(response.headers['x-ratelimit-remaining'] === "0") {
      this.setState({
        loading: false,
        error: 'no-ratelimit-remaining',
        nextPage: response.config.url
      })
    }
    else {
      this.setState({
        loading: false,
        error: 'others',
      })
    }
  }

  handleRetry = () => {
    this.setState({
      error: null,
    }, this.handleLoadMore);
  }

  render() {
    const { q, repos, loading, error } = this.state;
    
    return (
      <Wrapper>
        <TextField
          value={q}
          className="input-field"
          onChange={this.handleChange}
          variant="outlined"
          placeholder="Repo search field"
        />
        <Table
          data={repos}
          loading={loading}
          loadMore={this.handleLoadMore}
        >
          {error === 'no-ratelimit-remaining' &&
            <div style={{ textAlign: 'center', padding: 20 }}>
              已達到 api 請求上限，請稍後再試 <Button variant="outlined" onClick={this.handleRetry}>
                重試
              </Button>
            </div>
          }
          {loading &&
            <div style={{ textAlign: 'center', padding: 20 }}>
              <CircularProgress/>
            </div>
          }
        </Table>
      </Wrapper>
    );
  }
}

export default App;
