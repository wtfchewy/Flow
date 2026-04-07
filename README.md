<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" height="128" alt="Peak" />
</p>

<h1 align="center">Peak</h1>

<p align="center">
  A fast, native note-taking app built with Tauri and BlockSuite.
</p>

<br />

<p align="center">
  <video src="landing/public/video.mp4" width="720" autoplay loop muted></video>
</p>

<br />

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)

### Setup

```bash
git clone --recurse-submodules https://github.com/user/peak.git
cd peak
pnpm install
```

### Development

```bash
# Desktop (Tauri)
pnpm tauri dev

# Web
pnpm dev:web
```

### Build

```bash
pnpm tauri build
```

## Contributing

1. Fork the repo and create a feature branch
2. Make your changes
3. Commit with a clear message describing what changed and why
4. Open a pull request against `main`

## License

MIT
