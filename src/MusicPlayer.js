import React, { Component } from 'react';
import { bytesToBase64 } from 'byte-base64';

export default class MusicPlayer extends Component {
  constructor(props) {
    super();
    this.state = {
      currentSong: null,
      nextSong: null,
      currentTime: null,
      totalTime: null,
      percentage: null
    };
    this.firstLoad();
    setInterval(this.updateProgress.bind(this), 100);
  }

  firstLoad() {
    fetch('http://localhost:8080/currentSong')
      .then((response) => response.blob())
      .then((response) => {
        const state = this.state;
        state.currentSong = window.URL.createObjectURL(response);
        const src =
          document.querySelector('#audio source') ||
          document.createElement('source');
        src.src = state.currentSong;
        const audio = document.getElementById('audio');
        audio.appendChild(src);
        audio.volume = 0.05;
        audio.addEventListener('playing', this.timeOnChange.bind(this));
        audio.addEventListener('loadedmetadata', this.onAudioLoad.bind(this));
        audio.addEventListener('change', this.changeCurrentTime.bind(this));
      })
      .catch((err) => {
        console.log('error');
        console.error(err);
      });

    fetch('http://localhost:8080/currentSongInfo')
      .then((response) => response.json())
      .then((response) => {
        const tags = response.tags;
        if (tags.image) {
          const base64Prefix = 'data:image/' + tags.image.mime + ';base64,';
          const imageByte64 = bytesToBase64(tags.image.imageBuffer.data);
          const base64String = base64Prefix + imageByte64;
          document.querySelector('.albumArt img').src = base64String;
        } else {
          document.querySelector('.albumArt img').src =
            'https://www.nomadfoods.com/wp-content/uploads/2018/08/placeholder-1-e1533569576673-960x960.png';
        }

        document.querySelector('.songName').textContent =
          tags.title || 'Unknown Title';
        document.querySelector('.artistName').textContent =
          tags.artist || 'Unknown Artist';
        const albumName = tags.album || 'Unknown Album';
        const albumYear = tags.raw.TDOR || 'Unknown Year';
        document.querySelector('.albumNameAndYear').textContent = [
          albumName,
          albumYear
        ].join(' - ');
      })
      .catch((err) => {
        console.log(err);
      });

    fetch('http://localhost:8080/timestamp')
      .then((response) => response.json())
      .then((response) => {
        const state = this.state;
        const timestamp = response.timestamp / 1000;
        state.currentTime = timestamp;
        state.totalTime = response.duration / 1000;
        state.percentage = state.currentTime / state.totalTime;
        this.setState(state);
      })
      .catch((err) => console.error(err));
    // const nextSongResponse = fetch('http://localhost:8080/nextSong');
    // const nextSongInfoResponse = fetch('http://localhost:8080/nextSongInfo');
  }

  timeOnChange(event) {
    console.log(event.target.currentTime);
  }

  onAudioLoad() {
    // some code to calculate currentTime for first time
    document.querySelector('#audio').currentTime = this.state.currentTime;
    document.querySelector('#audio').play();
  }

  changeCurrentTime(time) {
    this.setState({ currentTime: time });
  }

  updateProgress() {
    const percentage =
      document.getElementById('audio').currentTime / this.state.totalTime;
    const state = this.state;
    state.currentTime = document.getElementById('audio').currentTime;
    state.percentage = percentage;
    this.setState(state);
    console.log(percentage);
  }

  formatTime(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const minutesString = minutes < 10 ? '0' + minutes : minutes;
    const seconds = Math.floor(timeInSeconds % 60);
    const secondsString = seconds < 10 ? '0' + seconds : seconds;
    return [minutesString, secondsString].join(':');
  }

  render() {
    return (
      <div className='musicPlayer'>
        <div className='albumArt'>
          <img src='https://www.nomadfoods.com/wp-content/uploads/2018/08/placeholder-1-e1533569576673-960x960.png' />
        </div>
        <div className='metadata'>
          <div className='artistName'></div>
          <div className='albumNameAndYear'></div>
          <div className='songName'></div>
          <div className='playedToTotal'>
            {this.formatTime(this.state.currentTime) +
              ' / ' +
              this.formatTime(this.state.totalTime)}
          </div>
          <div className='playedBar'>
            <div
              className='playedBarProgress'
              style={{ width: this.state.percentage * 99 + '%' }}
            />
          </div>
          <audio id='audio' controls={false}></audio>
        </div>
      </div>
    );
  }
}
