"use client";

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={`max-w-[1920px] w-screen mx-auto xl:px-10 px-2 py-4 ${className}`}
    >
      {children}
    </div>
  );
}

export default Container;
