const body = document.body;

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

setupReveal();
setupTiltCards();
setupSmoothLinks();
setupHeroIntroTyping();
setupSidebar();
