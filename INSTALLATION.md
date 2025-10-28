# DownTube Installation Guide

## 📦 Building the Installer

To build the Windows installer, run:

```bash
npm run build
```

This will create the installer in the `dist` folder.

## 🎯 Installation Location

### Default Installation Path
When users install DownTube, it will be installed to:
```
C:\Users\{username}\AppData\Local\Programs\DownTube
```

### Installation Type
- **User Installation** (not system-wide)
- No administrator privileges required
- Installs only for the current user
- Users can change the installation directory during setup

## 📁 Application Structure

After installation, the application structure will be:

```
C:\Users\{username}\AppData\Local\Programs\DownTube\
├── DownTube.exe              (Main application)
├── resources\
│   └── app.asar              (Application code)
├── bin\                      (Created on first run)
│   ├── yt-dlp.exe           (Auto-downloaded)
│   └── ffmpeg.exe           (Auto-downloaded)
├── locales\
├── chrome_100_percent.pak
├── chrome_200_percent.pak
└── ... (other Electron files)
```

## 🔧 Dependency Management

### Automatic Download
On first launch, DownTube will automatically:
1. Check for `yt-dlp.exe` and `ffmpeg.exe` in the `bin` folder
2. If missing, download them from GitHub:
   - **yt-dlp**: https://github.com/yt-dlp/yt-dlp/releases/latest
   - **ffmpeg**: https://github.com/MurShidM01/YouTube-Playlist-Downloader-Application/releases

3. Save them to: `{InstallDir}\bin\`

### Storage Location
- **Installed App**: `C:\Users\{username}\AppData\Local\Programs\DownTube\bin\`
- **Development**: `%AppData%\Roaming\DownTube\bin\`

All dependencies are stored locally within the application directory.

## 🚀 Installer Features

### Setup Options
- ✅ Custom installation directory selection
- ✅ Desktop shortcut creation
- ✅ Start Menu shortcut creation
- ✅ Run application after installation
- ✅ Clean uninstall (removes app data)

### File Name Format
```
DownTube-Setup-1.0.1.exe
```

## 🗑️ Uninstallation

When uninstalling DownTube:
1. All application files are removed from `%LOCALAPPDATA%\Programs\DownTube`
2. Application data (settings, history) is removed from `%APPDATA%\DownTube`
3. Desktop and Start Menu shortcuts are removed

## 📝 User Data

Application settings and download history are stored separately:
```
C:\Users\{username}\AppData\Roaming\DownTube\
├── settings.json
└── history.json
```

This allows settings to persist across reinstalls if desired.

## 🛠️ Development vs Production

### Development Mode
```bash
npm start
```
- Uses: `%APPDATA%\Roaming\DownTube\bin\` for dependencies
- Settings: `%APPDATA%\Roaming\DownTube\`

### Production (Installed)
- Uses: `{InstallDir}\bin\` for dependencies
- Settings: `%APPDATA%\Roaming\DownTube\`

## 🔐 Permissions

### No Admin Required
- Installation to `%LOCALAPPDATA%` doesn't require admin rights
- Downloads to `bin` folder work without elevation
- Safe for standard user accounts

### Write Permissions
The application can write to:
- Installation directory (`%LOCALAPPDATA%\Programs\DownTube\bin\`)
- User data directory (`%APPDATA%\DownTube\`)
- User-selected download folders

## 📊 Installation Statistics

### Installer Size
- **Setup file**: ~150 MB (includes Electron runtime)
- **Installed size**: ~200 MB (including dependencies)

### First Launch
- Initial dependency download: ~80 MB (yt-dlp + ffmpeg)
- Download time: 30-60 seconds (depends on internet speed)
- Progress shown in splash screen

## 🐛 Troubleshooting

### Dependencies Not Downloading
1. Check internet connection
2. Retry from splash screen
3. Manually download and place in: `{InstallDir}\bin\`

### Permission Denied Error
- Ensure installation directory is writable
- Try running as administrator (one-time fix)
- Check antivirus isn't blocking

### App Won't Start
1. Check `yt-dlp.exe` and `ffmpeg.exe` exist in `bin` folder
2. Verify they're not quarantined by antivirus
3. Reinstall the application

## 🔄 Updates

### Auto-Update Check
- Checks GitHub releases on startup
- Notifies user if new version available
- Manual download and install required

### Manual Update
1. Download new installer
2. Run installer (will upgrade existing installation)
3. Settings and data are preserved

## 📋 Build Configuration

Key settings in `package.json`:

```json
{
  "build": {
    "appId": "com.ali.downtube",
    "productName": "DownTube",
    "nsis": {
      "perMachine": false,           // User installation
      "allowElevation": false,       // No admin required
      "deleteAppDataOnUninstall": true
    }
  }
}
```

## 🎉 Complete!

Your application is now configured to:
- ✅ Install to `%LOCALAPPDATA%\Programs\DownTube`
- ✅ Store dependencies in `{InstallDir}\bin\`
- ✅ Work without admin privileges
- ✅ Auto-download required tools on first run
- ✅ Provide clean uninstallation

---

**Version**: 1.0.1  
**Author**: Ali Khan Jalbani  
**License**: ISC

