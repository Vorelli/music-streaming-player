import React, { Component, createRef } from 'react';
import './index.sass';
import questionImage from '../public/question.png';

export default class MusicPlayer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      websocket: null,
      currentSong: null,
      currentSongInfo: {},
      nextSong: null,
      nextSongInfo: {},
      prevSong: null,
      prevSongInfo: {},
      draggingVolume: false,
      volume: Number.parseFloat(localStorage.getItem('volume')) || 5,
      paused: false,
      setPause: props.setPause || (() => {}),
      address: props.address || 'localhost:8080',
      scrollSensitivity: 3,
      duration: undefined,
      durationFormatted: undefined,
      currentTime: undefined,
      currentTimeDisplay: undefined,
      audioRef: createRef(),
      get audio() {
        return this.audioRef.current;
      }
    };
  }

  httpFetchCorsGet(end) {
    return fetch('http://' + this.state.address + end, { mode: 'cors' });
  }

  fetchSongAndInfo(key, timestamp = false) {
    return Promise.all([
      this.httpFetchCorsGet('/' + key + 'Song'),
      this.httpFetchCorsGet('/' + key + 'SongInfo'),
      timestamp ? this.httpFetchCorsGet('/timestamp') : Promise.resolve('')
    ]);
  }

  componentDidMount() {
    this.firstLoad();

    const newState = {
      volumeControl: document.querySelector('.volumeControl'),
      volumeController: document.querySelector('.volumeController'),
      mounted: true
    };
    setTimeout(this.setState.bind(this, { beenFiveSeconds: true }), 5000);
    this.setState(newState);

    newState.volumeControl.addEventListener('mousedown', (ev) => {
      this.setState({ draggingVolume: true });
      this.mouseMoved(ev);
    });

    document.addEventListener('mouseup', (_) =>
      this.setState({ draggingVolume: false })
    );
    document.addEventListener('mousemove', this.mouseMoved.bind(this));

    this.state.audio.addEventListener('paused', () => {
      this.setState({ paused: true });
      this.state.setPause(true);
    });
    this.state.audio.addEventListener('playing', () => {
      this.setState({ paused: false });
      this.state.setPause(false);
    });
  }

  handleScroll(e) {
    e.stopPropagation();
    e.preventDefault();

    let currentPercent = this.state.audio.volume * 100;
    const diff = e.deltaY > 0 ? -1 : e.deltaY < 0 ? 1 : 0;
    currentPercent += diff * this.state.scrollSensitivity;
    currentPercent = Math.min(100, Math.max(0, currentPercent));

    this.setVolumeAndVolumeController(currentPercent);
  }

  handleWebsocketMessage(messageEvent) {
    const data = messageEvent.data;
    const commands = {
      next: this.playNext.bind(this),
      prev: this.playPrev.bind(this),
      playing: () => this.state.audio.play(),
      paused: () => this.state.audio.pause(),
      reset: this.reset.bind(this)
    };
    if (commands[data]) commands[data]();
    else if (data.slice(0, 8) === 'newtime:') {
      this.state.audio.currentTime = data.slice(9) / 1000;
    }
  }

  firstLoad() {
    const websocket = new WebSocket('ws://' + this.state.address);
    websocket.onmessage = this.handleWebsocketMessage.bind(this);
    this.setState({ websocket });
    this.reset();
  }

  reset() {
    const pingStart = new Date();
    Promise.all([
      this.fetchSongAndInfo('current', true),
      this.fetchSongAndInfo('next'),
      this.fetchSongAndInfo('prev')
    ])
      .then((values) => {
        const loadNextSongIntoStateValues = [
          values[1][0].blob(), // song blob
          values[1][1].json() //  song info JSON
        ];
        const loadPrevSongIntoStateValues = [
          values[2][0].blob(), // song blob
          values[2][1].json() //  song info JSON
        ];
        const setupCurrentSongValues = [
          values[0][0].blob(), // song blob
          values[0][1].json(), // song info JSON
          values[0][2].json() //  timestamp JSON
        ];

        Promise.all([
          ...loadNextSongIntoStateValues,
          ...loadPrevSongIntoStateValues
        ])
          .then((values) => {
            const nextSongVals = [values[0], values[1]];
            const prevSongVals = [values[2], values[3]];
            this.loadSongIntoState(nextSongVals, 'next');
            this.loadSongIntoState(prevSongVals, 'prev');
          })
          .then(() =>
            Promise.all(setupCurrentSongValues).then((values) => {
              this.setVolumeAndVolumeController(this.state.volume);
              this.allCurrentSongInfoLoaded(pingStart, values);
            })
          );
      })
      .catch((err) => console.error(err));
  }

  setVolumeAndVolumeController(percentage) {
    this.state.volumeController.style.height = percentage + '%';
    this.state.audio.volume = percentage / 100;
    this.setState({ volume: percentage });
    localStorage.setItem('volume', percentage);
  }

  mouseMoved(event) {
    if (this.state.draggingVolume) {
      const scrollTop = window.pageYOffset || document.body.scrollTop;
      let y = event.clientY - this.state.volumeControl.offsetTop + scrollTop;
      y = Math.max(Math.min(this.state.volumeControl.offsetHeight, y), 0);
      const percent = 100 - (y / this.state.volumeControl.offsetHeight) * 100;
      this.setVolumeAndVolumeController(percent);
    }
  }

  playNext() {
    const newStateProps = {
      // put next song into the current song slot
      prevSong: this.state.currentSong,
      prevSongInfo: this.state.currentSongInfo,
      currentSong: this.state.nextSong,
      currentSongInfo: this.state.nextSongInfo
    };
    this.playNewSource(newStateProps.currentSong); // and load it into the audio Ele

    this.setState(newStateProps, () => {
      this.fetchSongAndInfo('next')
        .then((values) => {
          const nextSongStuff = [values[0].blob(), values[1].json()];
          Promise.all(nextSongStuff).then((values) =>
            this.loadSongIntoState(values, 'next')
          );
        })
        .catch((err) => console.error(err));
    });
  }

  playPrev() {
    const newStateProps = {
      currentSong: this.state.prevSong,
      currentSongInfo: this.state.prevSongInfo,
      nextSong: this.state.currentSong,
      nextSongInfo: this.state.currentSongInfo
    };
    this.playNewSource(newStateProps.currentSong);

    this.setState(newStateProps, () => {
      this.fetchSongAndInfo('prev')
        .then((values) => {
          const prevSongStuff = [values[0].blob(), values[1].json()];
          Promise.all(prevSongStuff).then((values) =>
            this.loadSongIntoState(values, 'prev')
          );
        })
        .catch((err) => console.error(err));
    });
  }

  playNewSource(src) {
    this.state.audio.src = src;
    this.state.paused ? this.state.audio.pause() : this.state.audio.play();
  }

  loadSongIntoState(values, key) {
    const newState = {};
    newState[key + 'Song'] = URL.createObjectURL(values[0]);
    newState[key + 'SongInfo'] = this.formatTags(values[1]);
    this.setState(newState);
    return newState[key + 'Song'];
  }

  allCurrentSongInfoLoaded(pingStart, values) {
    // values array values:  0: currentSongBlob
    // 1: currentSongInfoJSON 2: timestampInfo
    this.playNewSource(
      this.loadSongIntoState([values[0], values[1]], 'current') // returns a blob URL
    );
    this.setState({ paused: values[2].message !== 'Currently playing' }, () => {
      // set time stamp with response time in mind.
      const currentTimeWithPing =
        values[2].timestamp / 1000 + (new Date() - pingStart) / 1000;
      this.state.audio.currentTime = currentTimeWithPing;
      !this.state.paused ? this.state.audio.play() : this.state.audio.pause();
    });
  }

  formatTags(JSONinfo) {
    const tags = JSONinfo.tags;
    return {
      artistName: tags.artist,
      songName: tags.title,
      album: tags.album,
      albumNameAndYear: tags.album + ' - ' + tags.year,
      albumArt: this.getAlbumArt(tags),
      totalTime: JSONinfo.duration / 1000
    };
  }

  getAlbumArt(tags) {
    return tags.image ? tags.image : questionImage;
  }

  formatTime(timeInSeconds) {
    if (!Object.is(NaN, timeInSeconds))
      return new Date(timeInSeconds * 1000).toISOString().substr(14, 5); // returns mm:ss
  }

  updateCurrentTime(ev) {
    this.setState({
      currentTimeDisplay: this.formatTime(ev.target.currentTime),
      currentTime: ev.target.currentTime,
      widthOfTimeDisplay:
        (ev.target.currentTime / this.state.duration) * 99 + '%'
    });
  }

  updateDuration(ev) {
    this.setState({
      durationFormatted: this.formatTime(ev.target.duration),
      duration: ev.target.duration
    });
  }

  render() {
    if (
      this.state.mounted &&
      this.state.websocket &&
      this.state.beenFiveSeconds &&
      (!this.state.currentSongInfo || !this.state.currentSong)
    ) {
      // maybe a controller was skipping songs too quickly that currentsong is null
      this.state.websocket.send('error');
    }
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
            {this.state.currentTimeDisplay +
              ' / ' +
              this.state.durationFormatted}
          </div>
          <div className='playedBar'>
            <div
              className='playedBarProgress'
              style={{
                width: this.state.widthOfTimeDisplay
              }}
            />
          </div>
          <audio
            ref={this.state.audioRef}
            id='audio'
            controls={false}
            onDurationChange={this.updateDuration.bind(this)} // wait until the audio is loaded
            onTimeUpdate={this.updateCurrentTime.bind(this)} //  update display and progress bar
          ></audio>
        </div>
        <div className='volumeControl' onWheel={this.handleScroll.bind(this)}>
          <span className='volumeController' />
        </div>
      </div>
    );
  }
}
