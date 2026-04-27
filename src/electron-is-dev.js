module.exports = process.type === 'renderer' ? false : !require('electron-squirrel-startup');
