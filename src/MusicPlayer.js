import React, { Component } from 'react';

export default class MusicPlayer extends Component {
  constructor(props) {
    super();
    this.state = {
      websocket: null,
      currentSong: null,
      currentSongInfo: {},
      nextSong: null,
      nextSongInfo: {},
      prevSong: null,
      prevSongInfo: {},
      draggingVolume: false,
      volume: 0.05
    };
  }

  fetchCurrentSong() {
    return Promise.all([
      fetch('http://localhost:8080/currentSong'),
      fetch('http://localhost:8080/currentSongInfo'),
      fetch('http://localhost:8080/timestamp')
    ]);
  }

  fetchNextSong() {
    return Promise.all([
      fetch('http://localhost:8080/nextSong'),
      fetch('http://localhost:8080/nextSongInfo')
    ]);
  }

  fetchPrevSong() {
    return Promise.all([
      fetch('http://localhost:8080/prevSong'),
      fetch('http://localhost:8080/prevSongInfo')
    ]);
  }

  firstLoad() {
    const websocket = new WebSocket('ws://localhost:8080');
    websocket.onopen = () => {
      websocket.send('hi');
    };
    websocket.onmessage = (messageEvent) => {
      switch (messageEvent.data) {
        case 'next':
          this.playNext();
          break;
        case 'prev':
          this.playPrev();
          break;
      }
    };
    this.setState({ websocket });

    const pingStart = new Date();
    Promise.all([
      this.fetchCurrentSong(),
      this.fetchNextSong(),
      this.fetchPrevSong()
    ])
      .then((values) => {
        const loadNextSongIntoStateValues = [
          values[1][0].blob(), // song blob
          values[1][1].json() //  song info json
        ];

        const loadPrevSongIntoState = [
          values[2][0].blob(),
          values[2][1].json()
        ];

        const setupCurrentSongValues = [
          values[0][0].blob(), // song blob
          values[0][1].json(), // song info JSON
          values[0][2].json() //  timestamp JSON
        ];

        Promise.all([...loadNextSongIntoStateValues, ...loadPrevSongIntoState])
          .then((values) => {
            const nextSongVals = [values[0], values[1]];
            const prevSongVals = [values[2], values[3]];
            this.loadNextSongIntoState(nextSongVals);
            this.loadPrevSongIntoState(prevSongVals);
          })
          .then(() =>
            Promise.all(setupCurrentSongValues).then((values) => {
              document.getElementById('audio').volume = 0.05;
              this.allCurrentSongInfoLoaded(pingStart, values);
            })
          );
      })
      .catch((err) => console.error(err));
  }

  componentDidMount() {
    this.firstLoad();
    setInterval(this.forceUpdate.bind(this), 100);

    this.setState({
      volumeControl: document.querySelector('.volumeControl'),
      volumeController: document.querySelector('.volumeController')
    });

    document
      .querySelector('.volumeControl')
      .addEventListener('mousedown', this.startDrag.bind(this));

    document.addEventListener('mouseup', this.stopDrag.bind(this));
    document.addEventListener('mousemove', this.mouseMoved.bind(this));
  }

  startDrag(event) {
    this.setState({ draggingVolume: true });
  }

  mouseMoved(event) {
    if (this.state.draggingVolume) {
      let y = event.clientY - 65;
      if (y < 0) y = 0;
      if (y > 163) y = 163;
      const exactPercentage = 100 - (y / 163) * 100;
      this.state.volumeController.style.height = exactPercentage + '%';
      document.getElementById('audio').volume = exactPercentage / 100;
      this.setState({ volume: exactPercentage / 100 });
    }
  }

  stopDrag(event) {
    if (this.state.draggingVolume) this.setState({ draggingVolume: false });
  }

  playNext() {
    this.setupNewAudioEle();
    const newStateProps = {
      prevSong: this.state.currentSong,
      prevSongInfo: this.state.currentSongInfo,
      currentSong: this.state.nextSong,
      currentSongInfo: this.state.nextSongInfo,
      nextSong: null,
      nextSongInfo: null
    };
    this.setupNewSourceEle(newStateProps.currentSong);

    this.setState(newStateProps, () => {
      const pingStart = new Date();
      fetch('http://localhost:8080/timestamp')
        .then((response) => response.json())
        .then((response) => {
          const currentTime =
            response.timestamp / 1000 + (new Date() - pingStart) / 1000;
        });

      this.fetchNextSong()
        .then((values) => {
          const nextSongStuff = [values[0].blob(), values[1].json()];

          Promise.all(nextSongStuff).then((values) =>
            this.loadNextSongIntoState(values)
          );
        })
        .catch((err) => console.error(err));
    });
  }

  playPrev() {
    this.setupNewAudioEle();
    const newStateProps = {
      prevSong: null,
      prevSongInfo: null,
      currentSong: this.state.prevSong,
      currentSongInfo: this.state.prevSongInfo,
      nextSong: this.state.currentSong,
      nextSongInfo: this.state.currentSongInfo
    };
    this.setupNewSourceEle(newStateProps.currentSong);

    this.setState(newStateProps, () => {
      const pingStart = new Date();
      fetch('http://localhost:8080/timestamp')
        .then((response) => response.json())
        .then((response) => {
          const currentTime =
            response.timestamp / 1000 + (new Date() - pingStart) / 1000 - 0.5;
        });
      this.fetchPrevSong()
        .then((values) => {
          const prevSongStuff = [values[0].blob(), values[1].json()];
          Promise.all(prevSongStuff).then((values) =>
            this.loadPrevSongIntoState(values)
          );
        })
        .catch((err) => console.error(err));
    });
  }

  setupNewAudioEle() {
    // once a song ends, start playing the next preloaded song
    document.querySelector('#audio').pause();
    const audioEle = document.querySelector('#audio');
    document.querySelector('.metadata').removeChild(audioEle);
    // we replace the audio element in order to prevent
    // caching fucking us up and it guarentees
    // that the audio element will be at the start
    // rather than the end going in an endless loop
    const newAudioEle = document.createElement('audio');
    newAudioEle.id = 'audio';
    newAudioEle.volume = this.state.volume;
    document.querySelector('.metadata').appendChild(newAudioEle);
  }

  setupNewSourceEle(src) {
    const source = document.createElement('source');
    source.src = src;
    document.getElementById('audio').appendChild(source);
    document.getElementById('audio').play();
  }

  loadPrevSongIntoState(values) {
    // values array indices: 0: prevSongBlob
    // 1: prevSongInfoJSON
    const newStateProps = {
      prevSong: URL.createObjectURL(values[0]),
      prevSongInfo: this.formatTags(values[1])
    };
    this.setState(newStateProps);
  }

  loadNextSongIntoState(values) {
    // values array indices:  0: nextSongBlob
    // 1: nextSongInfoJSON
    const newStateProps = {
      nextSong: URL.createObjectURL(values[0]),
      nextSongInfo: this.formatTags(values[1])
    };
    this.setState(newStateProps);
  }

  allCurrentSongInfoLoaded(pingStart, values) {
    // values array values:  0: currentSongBlob
    // 1: currentSongInfoJSON 2: timestampInfo
    const currentSong = window.URL.createObjectURL(values[0]);
    const source = document.createElement('source');
    source.src = currentSong;
    document.getElementById('audio').appendChild(source);

    const newStateProps = {};
    newStateProps.currentSong = currentSong;
    newStateProps.currentSongInfo = this.formatTags(values[1]);

    // set time stamp with ping in mind.
    const currentTimeWithPing =
      values[2].timestamp / 1000 + (new Date() - pingStart) / 1000 - 0.5;

    this.setState(newStateProps);

    document.querySelector('#audio').currentTime = currentTimeWithPing;
    document.querySelector('#audio').play();
    this.forceUpdate();
  }

  formatTags(JSONinfo) {
    const tags = JSONinfo.tags;
    const duration = JSONinfo.duration;
    return {
      artistName: tags.artist,
      songName: tags.title,
      album: tags.album,
      albumNameAndYear: tags.album + ' - ' + tags.year,
      albumArt: this.getAlbumArt(tags),
      totalTime: duration / 1000
    };
  }

  getAlbumArt(tags) {
    if (tags.image) {
      return tags.image;
    } else {
      return 'https://www.nomadfoods.com/wp-content/uploads/2018/08/placeholder-1-e1533569576673-960x960.png';
    }
  }

  formatTime(timeInSeconds) {
    const minutes = ~~(timeInSeconds / 60);
    const seconds = ~~(timeInSeconds % 60);
    const minutesString = minutes < 10 ? '0' + minutes : minutes;
    const secondsString = seconds < 10 ? '0' + seconds : seconds;
    return [minutesString, secondsString].join(':');
  }

  render() {
    return (
      <div className='musicPlayer'>
        <div className='albumArt'>
          <span className='centerImg' />
          <img
            alt={this.state.currentSongInfo.album + ' Art'}
            src={this.state.currentSongInfo.albumArt}
          />
        </div>
        <div className='metadata'>
          <div className='artistName'>
            {this.state.currentSongInfo.artistName || 'Loading...'}
          </div>
          <div className='albumNameAndYear'>
            {this.state.currentSongInfo.albumNameAndYear || 'Loading...'}
          </div>
          <div className='songName'>{this.state.currentSongInfo.songName}</div>
          <div className='playedToTotal'>
            {this.formatTime(
              document.getElementById('audio') &&
                document.getElementById('audio').currentTime
            ) +
              ' / ' +
              this.formatTime(
                document.getElementById('audio') &&
                  document.getElementById('audio').duration
              )}
          </div>
          <div className='playedBar'>
            <div
              className='playedBarProgress'
              style={{
                width:
                  ((document.getElementById('audio') &&
                    document.getElementById('audio').currentTime) /
                    (document.getElementById('audio') &&
                      document.getElementById('audio').duration)) *
                    99 +
                  '%'
              }}
            />
          </div>
          <audio id='audio' controls={false}></audio>
        </div>
        <div className='volumeControl'>
          <span className='volumeController' />
        </div>
      </div>
    );
  }
}
