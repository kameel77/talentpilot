import { AuthPanel } from "@/components/auth/AuthPanel";
import { AuthPanelProvider } from "@/components/auth/AuthPanelContext";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthPanelProvider>
            <div className="flex min-h-screen w-full">
                <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12">
                    {children}
                </div>

                <AuthPanel />
            </div>
        </AuthPanelProvider>
    );
}
