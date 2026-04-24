const body = document.body;

function createMouseGlow() {
  const glow = document.createElement("div");
  glow.className = "mouse-glow";
  body.appendChild(glow);

  window.addEventListener("mousemove", (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  });
}

function createParticles() {
  const canvas = document.createElement("canvas");
  canvas.className = "bg-particles";
  body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let width = 0;
  let height = 0;
  let particles = [];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    particles = Array.from({ length: Math.max(22, Math.floor(width / 58)) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2.6 + 1,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.4 + 0.2
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 165, 203, ${p.alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
}

function setupReveal() {
  const revealItems = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );
  revealItems.forEach((item) => observer.observe(item));
}

function setupTiltCards() {
  const cards = document.querySelectorAll(".tilt-card");
  cards.forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const dx = event.clientX - rect.left - rect.width / 2;
      const dy = event.clientY - rect.top - rect.height / 2;
      card.style.transform = `perspective(900px) rotateX(${(-dy / rect.height) * 8}deg) rotateY(${(dx / rect.width) * 8}deg) translateY(-4px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

function setupSmoothLinks() {
  const navLinks = document.querySelectorAll('a[data-transition="true"]');
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      event.preventDefault();
      body.style.transition = "opacity 0.32s ease";
      body.style.opacity = "0";
      setTimeout(() => {
        window.location.href = href;
      }, 220);
    });
  });
}

function setupHeroIntroTyping() {
  const el = document.getElementById("hero-intro-typing");
  if (!el) return;

  const fullText = "A curious little human exploring the world •̀֊•́";
  let index = 0;
  el.textContent = "";

  const timer = setInterval(() => {
    index += 1;
    el.textContent = fullText.slice(0, index);
    if (index >= fullText.length) {
      clearInterval(timer);
    }
  }, 75);
}

function setupSidebar() {
  const sidebar = document.getElementById("portfolio-sidebar");
  if (!sidebar) return;

  sidebar.setAttribute("aria-hidden", "false");
}

// Background motion effects are intentionally disabled.
setupReveal();
setupTiltCards();
setupSmoothLinks();
setupHeroIntroTyping();
setupSidebar();
