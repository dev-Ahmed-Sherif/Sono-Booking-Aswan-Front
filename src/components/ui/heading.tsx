"use client";

type HeadingProps = {
  title: string;
  description: string;
};

const Heading = ({ title, description }: HeadingProps) => {
  return (
    <div>
      <h2 className="text-lg sm:text-3xl font-bold tracking-tight">{title}</h2>
      {/* <p className="text-lg text-muted-foreground">{description}</p> */}
    </div>
  );
};

export default Heading;
