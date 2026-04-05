export function Features() {
  return (
    <section id="features" className="relative bg-surface px-6 pb-32 pt-20">
      <div className="mx-auto grid w-full gap-x-3 gap-y-10 tracking-tight sm:max-w-4xl sm:grid-cols-6 sm:gap-y-14">

        {/* Native & Fast */}
        <div className="group relative flex flex-col items-center justify-center text-center sm:col-span-2 sm:col-start-2">
          <svg className="mb-5 h-18 w-18 overflow-visible fill-current" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path className="origin-[50%_40%] scale-25 opacity-0 blur-sm transition duration-300 group-hover:-translate-x-1 group-hover:-translate-y-2 group-hover:scale-50 group-hover:opacity-100 group-hover:blur-none" d="M6 15.54c0 .457.352.797.844.797h6.62l-3.491 9.492c-.457 1.207.796 1.851 1.582.867L22.207 13.384c.2-.246.305-.48.305-.75 0-.445-.352-.797-.844-.797h-6.62l3.491-9.492c.457-1.207-.797-1.852-1.582-.856L6.305 14.79c-.2.258-.305.492-.305.75z" />
            <path className="origin-center transition duration-300 group-hover:translate-x-1 group-hover:delay-100" d="M6 15.54c0 .457.352.797.844.797h6.62l-3.491 9.492c-.457 1.207.796 1.851 1.582.867L22.207 13.384c.2-.246.305-.48.305-.75 0-.445-.352-.797-.844-.797h-6.62l3.491-9.492c.457-1.207-.797-1.852-1.582-.856L6.305 14.79c-.2.258-.305.492-.305.75z" />
          </svg>
          <h2 className="relative z-10 text-3xl font-bold">Blazing fast<br />native app</h2>
        </div>

        {/* Stay on Track */}
        <div className="group flex flex-col items-center justify-center text-center sm:col-span-2">
          <svg className="mb-5 h-18 w-18 fill-current" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12.953 26.14c6.54 0 11.953-5.425 11.953-11.953 0-1.042-.14-2.05-.422-3.011a5.082 5.082 0 0 1-1.922.457c.223.808.352 1.676.352 2.555a9.915 9.915 0 0 1-9.96 9.96 9.913 9.913 0 0 1-9.95-9.96c0-5.532 4.406-9.961 9.937-9.961 1.29 0 2.508.234 3.633.68.117-.669.363-1.29.703-1.84-1.336-.54-2.8-.833-4.336-.833C6.414 2.234 1 7.648 1 14.188 1 20.715 6.426 26.14 12.953 26.14Zm9.129-16.019c2.215 0 4.066-1.828 4.066-4.055C26.148 3.828 24.297 2 22.082 2c-2.227 0-4.066 1.828-4.066 4.066 0 2.227 1.84 4.055 4.066 4.055Z" />
            <path className="origin-[47%_53%] transition duration-350 group-hover:rotate-180" d="M13.762 14.633c0 .469-.364.82-.82.82a.8.8 0 0 1-.81-.823V6.734c0-.457.352-.808.81-.808.456 0 .82.351.82.808v7.899Z" />
            <path className="origin-[47%_53%] transition duration-300 group-hover:rotate-45" d="M12.941 15.453H6.824a.801.801 0 0 1-.82-.82c0-.457.351-.809.82-.809h6.116c.46 0 .822.34.822.809 0 .469-.364.82-.82.82Z" />
          </svg>
          <h2 className="text-3xl font-bold">Stay on<br />track</h2>
        </div>

        {/* Write, Draw & Plan */}
        <div className="group flex flex-col items-center justify-center text-center sm:col-span-2">
          <svg className="mb-5 h-18 w-18 fill-current overflow-visible transition duration-300 group-hover:-translate-y-px group-hover:-rotate-2" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M8.11 25.563h12.316c2.203 0 3.422-1.16 3.422-3.375v-8.883H4.676v8.883c0 2.214 1.219 3.375 3.433 3.375Zm5.109-1.758H8.086c-.973 0-1.524-.551-1.524-1.524V14.99h6.657v8.815Zm2.086 0V14.99h6.656v7.291c0 .973-.55 1.524-1.523 1.524h-5.133Z" />
            <path className="origin-[85%_45%] transition duration-300 group-hover:rotate-[18deg]" d="M23.848 14.992h.082c1.03-.223 1.605-1.055 1.605-2.25V9.66c0-1.43-.797-2.332-2.226-2.332H20.94c.622-.621.985-1.465.985-2.437C21.926 2.617 20.133 1 17.859 1c-1.64 0-3 .902-3.597 2.473C13.664 1.903 12.316 1 10.664 1 8.402 1 6.598 2.617 6.598 4.89c0 .973.363 1.817.996 2.438H5.227C3.855 7.328 3 8.23 3 9.66v3.082c0 1.195.563 2.027 1.594 2.25h19.254Zm-10.63-1.687H5.708c-.586 0-.82-.246-.82-.832V9.918c0-.586.234-.82.82-.82h7.512v4.207Zm2.087 0V9.098h7.535c.586 0 .808.234.808.82v2.555c0 .586-.222.832-.808.832h-7.535ZM13.3 7.328h-1.828c-1.84 0-2.918-1.043-2.918-2.332s.937-2.039 2.226-2.039c1.395 0 2.52 1.055 2.52 2.79v1.581Zm1.922 0V5.746c0-1.734 1.125-2.789 2.52-2.789 1.288 0 2.226.75 2.226 2.04 0 1.288-1.067 2.331-2.918 2.331h-1.828Z" />
          </svg>
          <h2 className="w-full text-3xl font-bold">Write, draw<br />& plan</h2>
        </div>

        {/* Drag & Drop */}
        <div className="group flex flex-col items-center justify-center text-center sm:col-span-2">
          <svg className="mb-5 h-18 w-18 overflow-visible fill-current" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path className="origin-[75%_75%] transition duration-350 group-hover:-rotate-[40deg]" d="M21.695 25.288c4.653-1.687 6.633-5.953 4.758-11.109l-.867-2.402c-.926-2.543-2.672-3.586-4.723-2.871-.55-.715-1.394-.961-2.308-.633-.34.129-.633.305-.914.515-.598-.773-1.524-1.054-2.485-.714a3.225 3.225 0 0 0-.738.398l-1.336-3.656c-.504-1.395-1.77-1.98-3.07-1.512-1.313.48-1.899 1.734-1.395 3.129l3.34 9.188c.023.058.012.105-.047.128-.035.024-.082 0-.117-.035l-1.371-1.5c-.68-.726-1.5-.949-2.285-.668-1.067.399-1.758 1.418-1.313 2.625.106.34.34.75.61 1.09l3.925 4.746c2.977 3.586 6.446 4.7 10.336 3.281Zm-.504-1.535c-3.07 1.125-5.941.551-8.66-2.718l-3.926-4.723c-.117-.14-.199-.27-.269-.469-.14-.375.023-.809.469-.973.375-.128.68.012.972.329l2.72 2.8c.444.47.843.516 1.241.375.457-.164.645-.656.457-1.16L10.047 5.8c-.176-.469.035-.914.492-1.078.445-.164.879.059 1.043.527l2.965 8.145c.14.387.574.562.96.422.376-.14.587-.551.446-.926l-1.066-2.941c.152-.153.386-.305.597-.387.551-.2 1.008.047 1.22.621l.937 2.566c.14.399.586.551.96.41a.713.713 0 0 0 .434-.925l-.762-2.086c.165-.153.387-.305.61-.387.55-.2 1.008.047 1.219.621l.62 1.711c.153.41.587.563.962.422a.723.723 0 0 0 .445-.926l-.457-1.265c.973-.352 1.898.445 2.531 2.203l.738 2.004c1.606 4.43.153 7.804-3.75 9.222Z" />
            <g className="transition duration-200 group-hover:opacity-0 group-hover:delay-50">
              <path className="fill-transparent stroke-current stroke-[1.5px] transition-all duration-350 group-hover:duration-250 group-hover:[stroke-dashoffset:12]" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="12" strokeDashoffset="0" d="M1.75 16.719s-.084-3.054 1.281-5.688C4.35 8.488 6.391 6.906 7 6.687" />
            </g>
          </svg>
          <h2 className="text-3xl font-bold">Drag &<br />Drop</h2>
        </div>

        {/* Fluid transitions */}
        <div className="group flex flex-col items-center justify-center text-center sm:col-span-2">
          <div className="mb-5 h-18">
            <div className="gooey flex h-full items-center justify-center space-x-2.5">
              <div className="h-11 w-11 rounded-full bg-text transition duration-700 group-hover:translate-x-11" />
              <div className="h-7 w-7 rounded-full bg-text transition duration-700 group-hover:-translate-x-12" />
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="absolute">
              <defs>
                <filter id="gooey">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                  <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="gooey" />
                  <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
                </filter>
              </defs>
            </svg>
          </div>
          <h2 className="text-3xl font-bold">Fluid<br />transitions</h2>
        </div>

      </div>
    </section>
  )
}
