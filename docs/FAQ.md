## FAQ

This file covers frequently asked questions.

- [Why VERT?](#why-vert)
- [What happens with video files?](#what-happens-with-video-files)
- [Can I host my own video file converter?](#can-i-host-my-own-video-file-converter)
- [What about analytics?](#what-about-analytics)
- [What libraries does VERT use?](#what-libraries-does-vert-use)
- [Is it possible to fully prevent VERT from making requests to external services?](#is-it-possible-to-fully-prevent-vert-from-making-requests-to-external-services)

### Why VERT?

**File converters have always disappointed us.** They're ugly, riddled with ads, and most importantly; slow. We decided to solve this problem once and for all by making an alternative that solves all those problems, and more.

All non-video files are converted completely on-device; this means that there's no delay between sending and receiving the files from a server, and we never get to snoop on the files you convert.

### What happens with video files?

Video files get uploaded to our lightning-fast RTX 4000 Ada server. Your videos stay on there for an hour if you do not convert them. If you do convert the file, the video will stay on the server for an hour, or until it is downloaded. The file will then be deleted from our server.

### Can I host my own video file converter?

Yes. Check out the [Video Conversion](./VIDEO_CONVERSION.md) page.

### What about analytics?

We use [Plausible](https://plausible.io/privacy-focused-web-analytics), a privacy-focused analytics tool, to gather completely anonymous statistics. All data is anonymized and aggregated, and no identifiable information is ever sent or stored. You can view the analytics [here](https://ats.vert.sh/vert.sh) and choose to opt out in the [Settings](https://vert.sh/settings/) page.

### Is it possible to fully prevent VERT from making requests to external services?

Yes! If you would prefer VERT to not make any requests to external services (video conversion, analytics, among others), you can set the `PUB_DISABLE_ALL_EXTERNAL_REQUESTS` environment variable to `true` **during build time**.

The only external request VERT will make with this option is to `cdn.jsdelivr.net`, which is used to download FFmpeg's WebAssembly build.

### What libraries does VERT use?
VERT uses FFmpeg for audio and video conversion, imagemagick for images and Pandoc for documents. A big thanks to them for maintaining such excellent libraries for so many years.