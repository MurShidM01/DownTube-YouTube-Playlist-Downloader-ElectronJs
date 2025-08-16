# DownTube - YouTube Video & Playlist Downloader

A professional desktop application built with Electron.js for downloading YouTube videos and playlists in various formats and qualities.

## ✨ Features

### Core Functionality
- **Video Downloads**: Download individual YouTube videos as MP4 or MP3
- **Playlist Support**: Download entire playlists with range selection
- **Quality Selection**: Choose from available video qualities (144p to 4K) or audio bitrates
- **Format Options**: MP4 (video) or MP3 (audio only)
- **Progress Tracking**: Real-time download progress with speed and ETA
- **Download History**: Keep track of all completed downloads

### Professional Error Handling
- **Network Error Detection**: Automatic detection of internet connectivity issues
- **File System Validation**: Permission and disk space checking
- **Process Management**: Robust handling of yt-dlp and ffmpeg processes
- **Retry Mechanism**: Automatic retry for network-related failures
- **User-Friendly Messages**: Clear, actionable error messages
- **Error Logging**: Comprehensive error logging for debugging

### Auto-Update System
- **Automatic Checks**: Daily background update checks
- **GitHub Integration**: Fetches latest releases from the official repository
- **Smart Notifications**: Non-intrusive update notifications
- **User Preferences**: Remember user choices (skip version, don't show again)
- **Manual Checks**: Manual update checking from settings

### Modern UI/UX
- **Professional Design**: Clean, modern interface with light theme
- **Responsive Layout**: Works on various screen sizes
- **Theme Support**: Multiple color schemes available
- **Font Customization**: Choose from various font options
- **Frameless Window**: Modern window controls

## 🚀 Installation

### Prerequisites
- Windows 10/11 (64-bit)
- Node.js 16+ (for development)

### Download
1. Download the latest release from [GitHub Releases](https://github.com/MurShidM01/DownTube-YouTube-Playlist-Downloader-ElectronJs/releases)
2. Extract the ZIP file
3. Run `DownTube.exe`

### Development Setup
```bash
git clone https://github.com/MurShidM01/DownTube-YouTube-Playlist-Downloader-ElectronJs.git
cd DownTube-YouTube-Playlist-Downloader-ElectronJs
npm install
npm start
```

## 📖 Usage

### Basic Download
1. **Paste URL**: Enter a YouTube video or playlist URL
2. **Fetch Info**: Click "Fetch" to analyze the content
3. **Select Format**: Choose MP4 (video) or MP3 (audio)
4. **Choose Quality**: Select desired quality/bitrate
5. **Download**: Click "Download" to start

### Playlist Downloads
- **Range Selection**: Specify start and end positions for playlists
- **Concurrent Downloads**: Automatic parallel downloading (up to 3 items)
- **Progress Tracking**: Individual progress for each item

### Settings & Customization
- **Output Directory**: Set default download folder
- **Theme Selection**: Choose from multiple color schemes
- **Font Options**: Customize application fonts
- **Update Preferences**: Configure auto-update behavior

## 🔧 Error Handling

### Network Issues
- Automatic internet connectivity detection
- Clear error messages with recovery suggestions
- Retry mechanism for temporary failures

### File System Errors
- Permission validation before downloads
- Disk space checking
- Output directory validation

### Process Errors
- yt-dlp availability checking
- ffmpeg integration validation
- Process cleanup on cancellation

### User Experience
- Non-blocking error notifications
- Actionable error messages
- Graceful degradation

## 🔄 Update System

### Automatic Updates
- Daily background checks for new versions
- Non-intrusive notification system
- Smart update scheduling

### Update Options
- **Download Update**: Open GitHub release page
- **Remind Me Later**: Check again later
- **Skip Version**: Don't show this version again
- **Don't Show Again**: Never show updates for this version

### Manual Updates
- Check for updates from settings
- View current version information
- Access update preferences

## 🛠️ Technical Details

### Architecture
- **Main Process**: Electron main process with error handling
- **Renderer Process**: Modern web-based UI
- **IPC Communication**: Secure inter-process communication
- **Error Logging**: File-based error logging system

### Dependencies
- **Core**: yt-dlp, ffmpeg
- **Framework**: Electron.js
- **UI**: Tailwind CSS, vanilla JavaScript
- **Error Handling**: Custom error handling system

### Error Categories
- `NETWORK_ERROR`: Internet connectivity issues
- `DOWNLOAD_ERROR`: Download process failures
- `FILE_SYSTEM_ERROR`: File/directory issues
- `PROCESS_ERROR`: External process failures
- `VALIDATION_ERROR`: Input validation issues

## 📝 Error Logs

Error logs are stored in:
```
%APPDATA%/DownTube/logs/error-YYYY-MM-DD.log
```

Each log entry includes:
- Timestamp
- Error context
- Error message
- Stack trace (if available)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- **yt-dlp**: YouTube download engine
- **ffmpeg**: Media processing
- **Electron**: Desktop application framework

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/MurShidM01/DownTube-YouTube-Playlist-Downloader-ElectronJs/issues)
- **Releases**: [GitHub Releases](https://github.com/MurShidM01/DownTube-YouTube-Playlist-Downloader-ElectronJs/releases)
- **Documentation**: This README and inline code comments

---

**Note**: This application is for personal use only. Please respect YouTube's terms of service and copyright laws.
