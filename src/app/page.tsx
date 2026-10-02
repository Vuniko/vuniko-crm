import Link from "next/link";

const demo = "/chat/bd8a8143-11e9-443b-b18e-1c8722aadc44";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07070a] text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-black tracking-tight">VUNIKO<span className="text-violet-500">.</span></Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm text-zinc-300 sm:block">Ingresar</Link>
          <Link href={demo} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">Probar demo</Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-24">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-sm text-violet-300">IA para negocios que trabajan con clientes</div>
          <h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.04em] sm:text-6xl lg:text-7xl">Tu negocio responde incluso cuando vos no podés.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">VUNIKO atiende consultas en tu web, aprende tus servicios y precios, detecta clientes interesados, captura sus datos y organiza cada oportunidad en tu CRM.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={demo} className="rounded-full bg-violet-600 px-6 py-3 font-bold hover:bg-violet-500">Probar Wally en vivo →</Link>
            <a href="#como-funciona" className="rounded-full border border-zinc-700 px-6 py-3 font-semibold text-zinc-200">Ver cómo funciona</a>
          </div>
          <p className="mt-4 text-sm text-zinc-500">Sin WhatsApp obligatorio · Chat propio · Atención 24/7</p>
        </div>

        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-violet-950/30">
          <div className="rounded-[1.5rem] border border-zinc-800 bg-white text-black">
            <div className="border-b px-5 py-4"><p className="font-bold">Wally</p><p className="text-sm text-emerald-600">● Online</p></div>
            <div className="space-y-3 p-5 text-sm">
              <div className="ml-auto max-w-[82%] rounded-2xl bg-black p-3 text-white">Hola, ¿cuánto cuesta un corte?</div>
              <div className="max-w-[88%] rounded-2xl bg-zinc-100 p-3">El corte clásico cuesta S/35. También tenemos corte + barba por S/55. ¿Querés que te ayude a reservar?</div>
              <div className="ml-auto max-w-[82%] rounded-2xl bg-black p-3 text-white">Sí, para mañana.</div>
              <div className="max-w-[88%] rounded-2xl bg-zinc-100 p-3">Perfecto. ¿Cómo te llamás?</div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-zinc-900 bg-zinc-950/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-violet-400">Un sistema, no solo un chatbot</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">De una pregunta en tu web a una oportunidad de venta organizada.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              ["01","El cliente pregunta","Abre el chat desde tu página y consulta como lo haría con una persona."],
              ["02","La IA responde","Usa precios, horarios, servicios, políticas y preguntas frecuentes de tu negocio."],
              ["03","Detecta intención","Reconoce interés en precios, reservas, compras o cuando quiere hablar con alguien."],
              ["04","VUNIKO organiza","Captura datos y convierte la conversación en un contacto y una oportunidad dentro del CRM."],
            ].map(([n,t,d]) => <div key={n} className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6"><span className="text-sm font-bold text-violet-400">{n}</span><h3 className="mt-8 text-lg font-bold">{t}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-violet-400">Entrenado para tu negocio</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Vos le enseñás tu negocio. VUNIKO se encarga de atender.</h2>
            <p className="mt-5 text-zinc-400">Carga una vez la información importante y el asistente la usa para responder de forma consistente sin inventar datos.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["Servicios y precios","Horarios y ubicación","Promociones","Preguntas frecuentes","Políticas","Tono de atención"].map(x=><div key={x} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 font-semibold">✓ {x}</div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-[2rem] bg-violet-600 p-8 sm:p-12">
          <p className="font-semibold text-violet-100">Ideal para barberías, peluquerías, estética y negocios con citas o consultas.</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Probalo como si fueras uno de tus clientes.</h2>
          <p className="mt-4 max-w-2xl text-violet-100">Preguntale precios, intentá reservar y pedile hablar con una persona. La demo está conectada al sistema real que construimos.</p>
          <Link href={demo} className="mt-7 inline-block rounded-full bg-white px-6 py-3 font-bold text-black">Abrir demo de Wally →</Link>
        </div>
      </section>

      <footer className="border-t border-zinc-900 px-6 py-8 text-center text-sm text-zinc-500">VUNIKO · Atención, IA y CRM en un solo lugar.</footer>
    </main>
  );
}
