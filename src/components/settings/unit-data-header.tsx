import { Home } from "lucide-react";

const UnitDataHeader = () => {
  return (
    <header
      className="relative z-10 flex items-center justify-center gap-3 py-5 px-6 border-b border-[#00004a] shadow-sm mb-4"
      style={{ backgroundColor: "#00005c" }}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-blue-600 shadow-lg">
          <Home className="h-6 w-6 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-wide">
            نظام إدارة إسكان محافظة أسوان
          </h1>
        </div>
      </div>
    </header>
  );
};

export default UnitDataHeader;
