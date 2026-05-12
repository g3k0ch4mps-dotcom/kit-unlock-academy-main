import mamuzaLogo from "@/assets/mamuza-logo.png";

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-10",
  md: "h-14",
  lg: "h-20",
  xl: "h-28",
};

export const Logo = ({ className = "", showTagline = false, size = "md" }: LogoProps) => {
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={mamuzaLogo} 
        alt="Mamuza Engineering - Inspire. Solve. Lead." 
        className={`${sizeClasses[size]} w-auto object-contain`}
      />
    </div>
  );
};

export default Logo;
