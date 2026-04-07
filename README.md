<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" height="128" alt="Peak" style="border-radius: 30px;" />
</p>

<h1 align="center">Peak</h1>

<p align="center">
  A fast, native note-taking app built with Tauri and BlockSuite.
</p>

<br />

<p align="center">
  <video src="https://github-production-user-asset-6210df.s3.amazonaws.com/52513072/574506307-57681ae3-04e9-49c0-9f6b-37a18e45fd81.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA/20260407/us-east-1/s3/aws4_request&X-Amz-Date=20260407T064811Z&X-Amz-Expires=300&X-Amz-Signature=58b95a3995439fcdcfecf6e3200f154b35679aaeb7dbb03239e0637d84660e70&X-Amz-SignedHeaders=host" width="720" autoplay loop muted></video>
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
