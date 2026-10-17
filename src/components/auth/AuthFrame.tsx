import Logo from "../Logo";

export default function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mist">
      <header className="mx-auto flex h-20 max-w-6xl items-center px-4 sm:px-6"><Logo /></header>
      <main id="main" className="mx-auto max-w-md px-4 pb-16">{children}</main>
    </div>
  );
}
