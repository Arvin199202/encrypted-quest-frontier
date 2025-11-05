const Hero = () => {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20" />
      
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto py-20">
        <div className="reveal-fold">
          <h2 className="text-5xl md:text-7xl font-bold mb-6 text-foreground leading-tight">
            Community Election.<br />
            Privacy Preserved.
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Cast your encrypted vote for community committee candidates. Your vote remains private until decryption.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;

