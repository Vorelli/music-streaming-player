import MusicPlayer from './MusicPlayer';
import '../public/index.sass';
const React = require('react');
const ReactDom = require('react-dom');
const root = document.getElementById('root');

ReactDom.render(<MusicPlayer />, root);
