"use client";
import { useState, useEffect } from "react";
import "./globals.css";
import "./data-tables-css.css";
import "./satoshi.css";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/SessionContext";
import { SidebarClear } from "@/components/Sidebarr/SidebarClear/SidebarClear";
import HeaderClear from "@/components/Sidebarr/SidebarClear/Header";
import { Sidebar2 } from "@/components/Sidebar2/Sidebar2";
import { Loader } from "@/components/common/Loader";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Vérifier l'authentification après le montage du composant
    if (!isAuthenticated && !user) {
      router.push("/auth/login");
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, router]);

  // Afficher un loader pendant la vérification de l'authentification
  if (isLoading) {
    return <Loader />;
  }

  // Rediriger si l'utilisateur n'est pas authentifié
  if (!isAuthenticated && !user) {
    return null;
  }

  return (
    <div className="dark:bg-boxdark-2 dark:text-bodydark">
      <div className="flex h-screen overflow-hidden">
        {/* <!-- ===== Sidebar Start ===== --> */}
        {/* <Sidebar navigation={adminNavigation} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} /> */}
        <SidebarClear/>
        {/* <!-- ===== Sidebar End ===== --> */}

        {/* <!-- ===== Content Area Start ===== --> */}
        <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          {/* Bannière d'impersonation — visible uniquement en mode audit admin */}
          <ImpersonationBanner />

          {/* <!-- ===== Header Start ===== --> */}
          {/* <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} /> */}
          <HeaderClear sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          {/* <!-- ===== Header End ===== --> */}

          {/* <!-- ===== Main Content Start ===== --> */}
          <main>
            <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">        
            {children}
            </div>
          </main>
          {/* <!-- ===== Main Content End ===== --> */}
        </div>
        {/* <!-- ===== Content Area End ===== --> */}
      </div>
    </div>
  );
}

