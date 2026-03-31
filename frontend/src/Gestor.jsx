import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Menu,
  ChevronLeft,
  Search,
  Bell,
  MapPin,
  Star,
} from "lucide-react";

const initialDrivers = [
  {
    id: 1,
    name: "Henrique Paulo",
    city: "Porto",
    rating: 4.3,
    reviews: 1081,
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: 2,
    name: "Henrique Ramasis",
    city: "Lisboa",
    rating: 4.2,
    reviews: 1289,
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: 3,
    name: "Henrique Cabral",
    city: "Tomar",
    rating: 4.6,
    reviews: 808,
    image:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: 4,
    name: "Henrique Cabral",
    city: "Beja",
    rating: 4.8,
    reviews: 430,
    image:
      "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: 5,
    name: "Henrique Gomes",
    city: "Algarve",
    rating: 4.9,
    reviews: 781,
    image:
      "https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=300&q=80",
  },
];

const navTop = [
  "Tuxys",
  "Utilizadores",
  "Clientes",
  "Motoristas",
  "Preços",
];

const navBottom = ["Relatórios", "Taxis e Motoristas", "Clientes e Viagens", "Reabastecimentos"];

function DriverCard({ driver, onOpen }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between rounded-md border border-[#e4c96d] bg-[#f5f0df] px-2 py-1.5 shadow-[0_0_0_1px_rgba(228,201,109,0.18)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={driver.image}
          alt={driver.name}
          className="h-[58px] w-[58px] rounded-sm object-cover"
        />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-[#333333]">{driver.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[13px] text-[#777777]">
            <MapPin className="h-3.5 w-3.5 fill-[#555555] text-[#555555]" />
            <span>{driver.city}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#9a9a9a]">
            <Star className="h-4 w-4 fill-[#efbe3d] text-[#efbe3d]" />
            <span className="text-[#777777]">{driver.rating.toFixed(1)}</span>
            <span>({driver.reviews} reviews)</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onOpen(driver)}
        className="ml-3 rounded-md border border-[#e4c96d] bg-[#faf7ec] px-6 py-2 text-[13px] font-medium text-[#e1b648] transition hover:bg-[#f5ecd1]"
      >
        Abrir
      </button>
    </motion.div>
  );
}

export default function TuxyMotoristasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState("Motoristas");
  const [openedDriver, setOpenedDriver] = useState(null);
  const [notifications, setNotifications] = useState(1);

  const filteredDrivers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialDrivers;
    return initialDrivers.filter(
      (driver) =>
        driver.name.toLowerCase().includes(q) ||
        driver.city.toLowerCase().includes(q) ||
        String(driver.id).includes(q)
    );
  }, [query]);

  const duplicatedColumns = [filteredDrivers, filteredDrivers];

  return (
    <div className="min-h-screen bg-[#f3f0f1] text-[#2f2f2f]">
      <div className="mx-auto min-h-screen w-full max-w-[1112px] overflow-hidden bg-[#f6f3f4] shadow-sm">
        <header className="flex h-[92px] items-center justify-between border-b border-[#8b8b8b] bg-[#f2f0f0] px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#f2e4a0] text-[#77715f] transition hover:brightness-95"
              aria-label="Abrir ou fechar menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-end gap-2">
              <span className="text-[28px] font-extrabold tracking-tight text-black">TUXY</span>
              <span className="mb-[3px] text-[18px] font-medium text-[#b0aaaa]">Gestor</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#f2e4a0] text-[#9d9267]"
              aria-label="Pesquisar"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={() => setNotifications(0)}
              className="relative flex h-10 w-10 items-center justify-center rounded-sm bg-[#f2e4a0] text-[#9d9267]"
              aria-label="Notificações"
            >
              <Bell className="h-5 w-5" />
              {notifications > 0 && (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#d59132]" />
              )}
            </button>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-92px)]">
          <motion.aside
            animate={{ width: sidebarOpen ? 167 : 0, opacity: sidebarOpen ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-r border-[#e1d7a8] bg-[#efe4aa]"
          >
            <div className="flex h-full flex-col text-[#353535]">
              <div className="flex items-center justify-between px-3 pb-2 pt-2 text-[11px] font-semibold text-[#9d8e61]">
                <span>Gerir</span>
                <ChevronLeft className="h-4 w-4" />
              </div>

              <nav>
                {navTop.map((item) => {
                  const active = item === selectedSection;
                  return (
                    <button
                      key={item}
                      onClick={() => setSelectedSection(item)}
                      className={`flex h-[38px] w-full items-center border-b border-[#e2d7a5] px-4 text-left text-[13px] font-semibold transition ${
                        active ? "bg-[#e8d48f]" : "bg-transparent hover:bg-[#eadc9f]"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </nav>

              <div className="px-3 pb-2 pt-8 text-[11px] font-semibold text-[#9d8e61]">Consultar</div>

              <nav>
                {navBottom.map((item) => (
                  <button
                    key={item}
                    onClick={() => setSelectedSection(item)}
                    className="flex h-[38px] w-full items-center border-b border-[#e2d7a5] px-4 text-left text-[13px] font-semibold transition hover:bg-[#eadc9f]"
                  >
                    {item}
                  </button>
                ))}
              </nav>
            </div>
          </motion.aside>

          <main className="flex-1 px-10 py-4">
            <h1 className="mt-1 text-[32px] font-bold leading-none text-[#2e2e2e] sm:text-[18px]">
              Motoristas
            </h1>

            <div className="mt-7 max-w-[190px]">
              <div className="flex h-[32px] items-center rounded-md border border-[#e4c96d] bg-[#faf9f4] px-2.5">
                <Search className="mr-2 h-3.5 w-3.5 text-[#bcbcbc]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nome ou NIF"
                  className="w-full bg-transparent text-[11px] text-[#4d4d4d] outline-none placeholder:text-[#b2b2b2]"
                />
              </div>
            </div>

            <div className="mt-9 grid grid-cols-1 gap-x-6 gap-y-3 xl:grid-cols-2">
              {duplicatedColumns.map((drivers, idx) => (
                <div key={idx} className="space-y-3">
                  {drivers.map((driver) => (
                    <DriverCard key={`${idx}-${driver.id}`} driver={driver} onOpen={setOpenedDriver} />
                  ))}
                </div>
              ))}
            </div>
          </main>
        </div>

        <footer className="fixed bottom-2 right-4 text-right text-[11px] leading-tight text-[#5f5f5f]">
          <div className="mb-1 flex items-center justify-end gap-2 text-[#6d6d6d]">
            <span>☁️</span>
            <span>📶</span>
            <span>🔊</span>
            <span>🔋</span>
          </div>
          <div className="font-medium">9:41</div>
          <div>31/01/2008</div>
        </footer>

        {openedDriver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center gap-4">
                <img
                  src={openedDriver.image}
                  alt={openedDriver.name}
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <div>
                  <h2 className="text-xl font-bold text-[#333333]">{openedDriver.name}</h2>
                  <p className="mt-1 text-sm text-[#777777]">{openedDriver.city}</p>
                  <p className="mt-1 text-sm text-[#777777]">
                    {openedDriver.rating.toFixed(1)} estrelas · {openedDriver.reviews} reviews
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setOpenedDriver(null)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
                >
                  Fechar
                </button>
                <button
                  onClick={() => alert(`Perfil de ${openedDriver.name} aberto.`)}
                  className="rounded-xl bg-[#efcf68] px-4 py-2 text-sm font-semibold text-[#5f4b08]"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
