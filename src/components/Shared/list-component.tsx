"use client";

import React from "react";
import { motion } from "framer-motion";

interface ListComponentProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  animationType?: "stagger" | "fade" | "slide" | "scale";
  delay?: number;
  duration?: number;
}

function ListComponent<T>({
  data,
  renderItem,
  keyExtractor = (_, index) => index.toString(),
  animationType = "stagger",
  delay = 0,
  duration = 0.5,
}: ListComponentProps<T>) {
  if (!data || data.length === 0) {
    return null;
  }

  const getAnimationVariants = () => {
    switch (animationType) {
      case "fade":
        return {
          hidden: { opacity: 0 },
          visible: (i: number) => ({
            opacity: 1,
            transition: {
              delay: delay + i * 0.1,
              duration,
            },
          }),
        };
      case "slide":
        return {
          hidden: { opacity: 0, x: -20 },
          visible: (i: number) => ({
            opacity: 1,
            x: 0,
            transition: {
              delay: delay + i * 0.1,
              duration,
            },
          }),
        };
      case "scale":
        return {
          hidden: { opacity: 0, scale: 0.8 },
          visible: (i: number) => ({
            opacity: 1,
            scale: 1,
            transition: {
              delay: delay + i * 0.1,
              duration,
            },
          }),
        };
      case "stagger":
      default:
        return {
          hidden: { opacity: 0, y: 20 },
          visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
              delay: delay + i * 0.1,
              duration,
            },
          }),
        };
    }
  };

  const variants = getAnimationVariants();

  return (
    <>
      {data.map((item, index) => (
        <motion.div
          key={keyExtractor(item, index)}
          custom={index}
          initial="hidden"
          animate="visible"
          variants={variants}
          whileHover={{
            scale: 1.05,
            transition: { duration: 0.2 },
          }}
          whileTap={{
            scale: 0.95,
            transition: { duration: 0.1 },
          }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </>
  );
}

export default ListComponent;
