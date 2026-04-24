"use client";

import React, { FC, useEffect, useRef } from "react";
import { motion, useInView, useAnimation } from "framer-motion";

interface Props {
  children: React.ReactNode;
}

const RevelSection: FC<Props> = ({ children, ...props }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const mainControls = useAnimation();

  useEffect(() => {
    if (isInView) {
      mainControls.start("visible");
    }
  }, [isInView, mainControls]);

  return (
    <motion.section
      ref={ref}
      style={{ position: "relative", overflow: "hidden" }}
      variants={{
        hidden: { opacity: 0, y: 35 },
        visible: { opacity: 1, y: 0 },
      }}
      initial="hidden"
      animate={mainControls}
      transition={{ ease: "easeInOut", duration: 2.8, delay: 0.25 }}
    >
      {children}
    </motion.section>
  );
};

export default RevelSection;
