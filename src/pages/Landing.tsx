import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { 
  ArrowRight,
  CheckCircle2,
  Play,
  Sparkles,
  Cpu,
  Bot
} from "lucide-react";

const roboticsKits = [
  {
    id: 1,
    name: "16-in-1 Building:bit Super Kit",
    description: "Programmable Robotics & STEM Kit for BBC Micro:bit V2/V1.5",
    sessions: 16,
    image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=300&fit=crop"
  },
  {
    id: 2,
    name: "McNummWheel Crab Overlord Car Kit",
    description: "Super Cool Bluetooth APP Control Robot Car",
    sessions: 12,
    image: "https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=400&h=300&fit=crop"
  },
  {
    id: 3,
    name: "ESP32 CAM 4WD Smart Robot Car Kit",
    description: "WiFi APP & Web Control Smart Car",
    sessions: 14,
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop"
  }
];

const iotKits = [
  {
    id: 4,
    name: "Most Complete Starter Kit for 2560",
    description: "The ultimate Arduino 2560 board starter kit",
    sessions: 20,
    image: "https://images.unsplash.com/photo-1553406830-ef2513450d76?w=400&h=300&fit=crop"
  },
  {
    id: 5,
    name: "Super Starter Kit for R3 Projects",
    description: "Comprehensive DIY Learning Kit",
    sessions: 18,
    image: "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=400&h=300&fit=crop"
  },
  {
    id: 6,
    name: "Raspberry Pi Pico Basic Starter Kit",
    description: "Get started with Raspberry Pi Pico",
    sessions: 12,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop"
  },
  {
    id: 7,
    name: "ESP32 Basic Starter Kit",
    description: "WiFi IoT Development & Learning Kit",
    sessions: 15,
    image: "https://images.unsplash.com/photo-1555255707-c07966088b7b?w=400&h=300&fit=crop"
  }
];

const steps = [
  {
    step: "01",
    title: "Purchase Your Kit",
    description: "Get a hardware kit from our store or authorized retailers."
  },
  {
    step: "02",
    title: "Create Your Account",
    description: "Sign up and explore the kit's project."
  },
  {
    step: "03",
    title: "Redeem Your Code",
    description: "Enter your single-use unlock code to access all sessions."
  },
  {
    step: "04",
    title: "Build & Learn",
    description: "Follow step-by-step tutorials with AI assistance."
  }
];

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero circuit-pattern">
        <div className="container py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/30 text-sm font-medium text-foreground mb-6 animate-fade-in">
              <Sparkles className="h-4 w-4 text-primary" />
              AI-Powered Learning for Hardware Builders
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 animate-slide-up">
              Master Your{" "}
              <span className="text-gradient-primary">Hardware Kit</span>
              {" "}with AI
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Secure, step-by-step tutorials for IoT, robotics, electronics, and AI kits.
              From assembly to deployment—with AI assistance at every step.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Button variant="hero" size="xl" asChild>
                <Link to="/register">
                  Start Learning Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline-primary" size="xl" asChild>
                <Link to="/programs">
                  <Play className="mr-2 h-5 w-5" />
                  Browse Programs
                </Link>
              </Button>
            </div>
            
            <div className="flex items-center justify-center gap-8 mt-12 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>Explore kit projects</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>No credit card required</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28 bg-card">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From purchase to project completion in four simple steps.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((item, index) => (
              <div key={item.step} className="relative">
                <div className="text-6xl font-bold text-primary/10 mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full">
                    <ArrowRight className="h-6 w-6 text-primary/30 -ml-3" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Robotics Kits */}
      <section id="robotics-kits" className="py-20 md:py-28 bg-background circuit-pattern">
        <div className="container">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-sm font-medium text-primary mb-4">
              <Bot className="h-4 w-4" />
              Robotics
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-gradient-primary">Robotics</span> Kits
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Build and program intelligent robots with step-by-step guidance.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {roboticsKits.map((kit) => (
              <div 
                key={kit.id}
                className="group rounded-xl overflow-hidden bg-card border border-border card-hover"
              >
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={kit.image} 
                    alt={kit.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-2">{kit.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{kit.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary font-medium">
                      {kit.sessions} sessions
                    </span>
                    <Button variant="outline-primary" size="sm" asChild>
                      <Link to={`/programs/${kit.id}`}>
                        View Program
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IoT Kits */}
      <section id="iot-kits" className="py-20 md:py-28 bg-card">
        <div className="container">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/30 text-sm font-medium text-foreground mb-4">
              <Cpu className="h-4 w-4 text-primary" />
              Internet of Things
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-gradient-primary">IoT</span> Kits
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect, automate, and build smart devices with comprehensive tutorials.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {iotKits.map((kit) => (
              <div 
                key={kit.id}
                className="group rounded-xl overflow-hidden bg-background border border-border card-hover"
              >
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={kit.image} 
                    alt={kit.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-base font-semibold mb-2">{kit.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{kit.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary font-medium">
                      {kit.sessions} sessions
                    </span>
                    <Button variant="outline-primary" size="sm" asChild>
                      <Link to={`/programs/${kit.id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Button variant="hero" size="lg" asChild>
              <Link to="/programs">
                View All Programs
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-gradient-dark text-background">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Build Something Amazing?
          </h2>
          <p className="text-lg text-background/70 max-w-2xl mx-auto mb-8">
            Join thousands of makers, engineers, and hobbyists learning with Mamuza Engineering LMS.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="xl" asChild>
              <Link to="/register">
                Create Free Account
              </Link>
            </Button>
            <Button variant="outline" size="xl" className="border-background/30 text-background hover:bg-background/10" asChild>
              <Link to="/login">
                I Have an Unlock Code
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;
