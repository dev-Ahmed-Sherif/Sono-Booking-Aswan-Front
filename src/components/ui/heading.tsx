"use client";

type HeadingProps = {
  title: string;
  description: string;
  pageName?: string;
};

const Heading = ({ title, description, pageName }: HeadingProps) => {
  const displayTitle = pageName ? `${pageName} — ${title}` : title;

  return (
    <div>
      <h2 className="text-lg sm:text-3xl font-bold tracking-tight">
        {displayTitle}
      </h2>
      {/* <p className="text-lg text-muted-foreground">{description}</p> */}
    </div>
  );
};

export default Heading;
