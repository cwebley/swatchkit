export function Button({
  children,
  href,
  variant = "primary",
  size,
  className = "",
  ...props
}) {
  const classes = ["button"];
  if (variant === "outline") classes.push("outline");
  else if (variant === "danger") classes.push("danger");
  if (size === "small") classes.push("small");
  else if (size === "large") classes.push("large");
  if (className) classes.push(className);

  const Component = href ? "a" : "button";
  const elementProps = href ? { href, ...props } : { type: "button", ...props };

  return (
    <Component className={classes.join(" ")} {...elementProps}>
      {children}
    </Component>
  );
}
