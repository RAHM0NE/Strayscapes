// ==========================
// 1. INITIAL SETUP & HELPERS
// ==========================

let currentSighting = null;

// Mapbox Init
mapboxgl.accessToken = 'pk.eyJ1IjoicmFobW9uZSIsImEiOiJjbWFsYXZmeHIwN2N5MmtzZHYxd2pna3dmIn0.QMappIJlM50UawPwfgvzUw';

// Supabase setup
const supabaseUrl = "https://pkefuiohsqaydfxbtjqk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZWZ1aW9oc3FheWRmeGJ0anFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0OTcwMDcsImV4cCI6MjA2MzA3MzAwN30.U_RZp_XJH2oNoYvg0z0SdcMRPVUhrxmIw-SMspYKHfU";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
const tableName = "sightings";

// Helper: Convert DDMM.MMMM to Decimal Degrees
function convertDDMMtoDecimal(coord) {
  const sign = coord < 0 ? -1 : 1;
  const absCoord = Math.abs(coord);
  const deg = Math.floor(absCoord / 100);
  const min = absCoord % 100;
  return sign * (deg + (min / 60));
}

// Helper: Return animal image URL based on mode or stored URL
function getAnimalImageUrl(sighting) {
  if (sighting.image_url) {
    return sighting.image_url;
  }
  const mode = sighting.mode || "";
  if (mode.toUpperCase().includes("CAT")) {
    return "assets/placeholder.png";
  } else if (mode.toUpperCase().includes("FOX")) {
    return "assets/placeholder.png";
  }
}

// Helper: Upload image and save URL to Supabase
async function uploadImageAndSaveURL(file, sightingId) {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `sightings/${sightingId}-${Date.now()}.${fileExt}`;

    // Upload the file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('sighting-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    // Get public URL for the uploaded file
    const { data: { publicUrl }, error: publicUrlError } = supabase.storage
      .from('sighting-images')
      .getPublicUrl(filePath);

    if (publicUrlError) {
      console.error('Error getting public URL:', publicUrlError);
      return null;
    }

    // Update the sighting row with the image URL
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ image_url: publicUrl })
      .eq('id', sightingId);

    if (updateError) {
      console.error("Failed to update Supabase image URL:", updateError);
      return null;
    }

    return publicUrl;
  } catch (error) {
    console.error('Unexpected error during upload:', error);
    return null;
  }
}

// ==========================
// 2. DOM ELEMENTS
// ==========================

const infoImage = document.getElementById('info-image');
const uploadInput = document.getElementById('upload-image-input');
const infoPanel = document.getElementById('info-panel');
const infoTimestamp = document.getElementById('info-timestamp');
const confirmRenameButton = document.getElementById('confirm-rename-inline');
const sightingNameText = document.getElementById('sighting-name-text');
const editNameButton = document.getElementById('edit-name-button');
const sightingDescription = document.getElementById('sighting-description');
const infoPanelContent = document.getElementById('info-panel-content');

// ==========================
// 3. INTRO & SCROLL INDICATORS
// ==========================

const tagline = document.querySelector('.tagline');
const introSection = document.querySelector('.intro');
const scrollUpIndicator = document.querySelector('.scroll-up-indicator');
const scrollDownIndicator = document.querySelector('.scroll-indicator');
const mapSection = document.querySelector('.map-section');
const mapContainer = document.getElementById('map');

let hasUnlocked = false;
let scrollDelta = 0;
const SCROLL_THRESHOLD = 80;
let lastScrollY = 0;

window.addEventListener('load', () => {
  document.body.classList.add('locked');
});

window.addEventListener('wheel', (e) => {
  // Ignore scroll events if the target is within the map container
  if (mapContainer.contains(e.target)) {
    return;
  }

  const scrollY = window.scrollY;

  if (!hasUnlocked) {
    scrollDelta += e.deltaY;

    if (scrollDelta >= SCROLL_THRESHOLD) {
      hasUnlocked = true;
      tagline.classList.add('visible');
      gsap.to(tagline, { opacity: 1, duration: 0.5 });

      setTimeout(() => {
        document.body.classList.remove('locked');
      }, 1000);
    } else {
      e.preventDefault();
    }
  } else {
    if (scrollY < lastScrollY && introSection.getBoundingClientRect().top > 0) {
      scrollDelta = 0;
      document.body.classList.add('locked');
      tagline.classList.remove('visible');
      gsap.to(tagline, { opacity: 0, duration: 0.5 });
      hasUnlocked = false;
    }
  }
  lastScrollY = scrollY;
}, { passive: false });

window.addEventListener('scroll', () => {
  // Ignore scroll events if the target is within the map container
  if (mapContainer.contains(document.activeElement)) {
    return;
  }

  const scrollY = window.scrollY;

  if (hasUnlocked && scrollY < 100) {
    tagline.classList.remove('visible');
    document.body.classList.add('locked');
    gsap.to(tagline, { opacity: 0, duration: 0.5 });
    hasUnlocked = false;
    scrollDelta = 0;
  }
  lastScrollY = scrollY;
});

document.querySelector('.scroll-indicator').addEventListener('click', () => {
  window.scrollBy({
    top: window.innerHeight * 0.5,
    behavior: 'smooth'
  });
});

window.addEventListener('scroll', function () {
  const indicator = document.querySelector('.scroll-indicator');
  if (window.scrollY > 90) {
    indicator.style.opacity = '0';
    indicator.style.pointerEvents = 'none';
  } else {
    indicator.style.opacity = '1';
    indicator.style.pointerEvents = 'auto';
  }
});

scrollDownIndicator.addEventListener('click', () => {
  if (document.body.classList.contains('locked')) {
    document.body.classList.remove('locked');
    hasUnlocked = true;
    tagline.classList.add('visible');
    gsap.to(tagline, { opacity: 1, duration: 0.5 });
  }
  setTimeout(() => {
    mapSection.scrollIntoView({ behavior: 'smooth' });
  }, 50);
});

scrollUpIndicator.addEventListener('click', () => {
  introSection.scrollIntoView({ behavior: 'smooth' });
});

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const introBottom = introSection.getBoundingClientRect().bottom + window.scrollY;
  if (scrollY > introBottom) {
    scrollUpIndicator.classList.add('visible');
  } else {
    scrollUpIndicator.classList.remove('visible');
  }
});

// ==========================
// 4. MAP & MARKERS
// ==========================

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-0.1276, 51.5072],
  zoom: 11
});

fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  }
})
  .then(response => response.json())
  .then(data => {
    data.forEach(sighting => {
      const { latitude, longitude, mode, timestamp } = sighting;
      const lat = convertDDMMtoDecimal(latitude);
      const lon = convertDDMMtoDecimal(longitude);

      if (
        typeof lat === "number" &&
        typeof lon === "number" &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
      ) {
        const el = document.createElement("div");
        el.className = "marker";

        // Custom marker image based on mode
        const modeUpper = mode ? mode.toUpperCase() : "";
        if (modeUpper.includes("CAT")) {
          el.style.backgroundImage = "url('assets/pawprint marker light.png')";
        } else {
          el.style.backgroundImage = "url('assets/pawprint marker dark.png')";
        }

        el.style.width = "50px";
        el.style.height = "50px";
        el.style.backgroundSize = "contain";
        el.style.backgroundRepeat = "no-repeat";
        el.style.backgroundPosition = "center";
        el.style.cursor = "pointer";

        new mapboxgl.Marker(el)
          .setLngLat([lon, lat])
          .addTo(map);

        // Show info panel when marker clicked
        el.addEventListener('click', () => {
          currentSighting = sighting;

          if (infoPanel.style.display === "block") {
            infoPanelContent.classList.add('transitioning');
            setTimeout(() => {
              // Update panel content here (name, image, description, etc.)
              sightingNameText.textContent = sighting.mode || "Unnamed Animal";
              sightingNameText.style.display = "inline";
              editNameButton.style.display = "inline";
              infoTimestamp.textContent = timestamp;
              infoImage.src = getAnimalImageUrl(sighting);
              if (sighting.description) {
                sightingDescription.innerHTML = marked.parse(sighting.description);
              } else {
                sightingDescription.innerHTML = '&nbsp;';
              }
              sightingDescription.contentEditable = "false";
              setTimeout(() => {
                infoPanelContent.classList.remove('transitioning');
              }, 10);
            }, 300);
          } else {
            infoPanel.style.display = "block";
            sightingNameText.textContent = sighting.mode || "Unnamed Animal";
            sightingNameText.style.display = "inline";
            editNameButton.style.display = "inline";
            infoTimestamp.textContent = timestamp;
            infoImage.src = getAnimalImageUrl(sighting);
            if (sighting.description) {
              sightingDescription.innerHTML = marked.parse(sighting.description);
            } else {
              sightingDescription.innerHTML = '&nbsp;';
            }
            sightingDescription.contentEditable = "false";
          }
        });
      }
    });
  })
  .catch(error => {
    console.error("Error fetching Supabase data:", error);
  });

// ==========================
// 5. INFO PANEL LOGIC
// ==========================

// --- Name Editing ---
function finishRenameUI() {
  sightingNameText.contentEditable = "false";
  editNameButton.style.display = "inline-flex";
  confirmRenameButton.style.display = "none";
}

editNameButton.addEventListener('click', () => {
  sightingNameText.contentEditable = "true";
  sightingNameText.focus();
  editNameButton.style.display = "none";
  confirmRenameButton.style.display = "inline-flex";
  // Move cursor to end
  const range = document.createRange();
  range.selectNodeContents(sightingNameText);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
});

async function saveSightingName() {
  const newName = sightingNameText.textContent.trim();
  if (!newName || !currentSighting?.id) {
    finishRenameUI();
    return;
  }
  if (newName !== currentSighting.mode) {
    const { error } = await supabase
      .from(tableName)
      .update({ mode: newName })
      .eq('id', currentSighting.id)
      .select()
      .maybeSingle();

    if (error) {
      alert("Failed to rename sighting.");
      console.error("Failed to rename sighting:", error);
      finishRenameUI();
      return;
    }
    currentSighting.mode = newName;
  }
  finishRenameUI();
}

confirmRenameButton.addEventListener('click', saveSightingName);

sightingNameText.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    await saveSightingName();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    sightingNameText.textContent = currentSighting?.mode || "Unnamed";
    finishRenameUI();
  }
});

// --- Description Editing ---
document.getElementById('description-wrapper').addEventListener('click', (e) => {
  e.stopPropagation();
  if (sightingDescription.contentEditable !== "true") {
    if (
      sightingDescription.textContent.trim() === "No description yet." ||
      sightingDescription.innerHTML === '&nbsp;' ||
      sightingDescription.textContent.trim() === ""
    ) {
      sightingDescription.textContent = "";
    } else {
      sightingDescription.textContent = currentSighting.description || "";
    }
    sightingDescription.contentEditable = "true";
    sightingDescription.focus();
    document.execCommand('selectAll', false, null);
  }
});

sightingDescription.addEventListener('keydown', async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sightingDescription.contentEditable = "false";
    const newDesc = sightingDescription.textContent.trim();

    if (currentSighting && newDesc !== (currentSighting.description || "")) {
      const { error } = await supabase
        .from(tableName)
        .update({ description: newDesc })
        .eq('id', currentSighting.id)
        .select()
        .maybeSingle();
      if (!error) {
        currentSighting.description = newDesc;
      } else {
        alert("Failed to save description.");
      }
    }

    if (!newDesc) {
      sightingDescription.innerHTML = '&nbsp;';
    } else {
      sightingDescription.innerHTML = marked.parse(newDesc);
    }
  }
});

sightingDescription.addEventListener('blur', async () => {
  if (sightingDescription.contentEditable === "true") {
    sightingDescription.contentEditable = "false";
    const newDesc = sightingDescription.textContent.trim();
    if (currentSighting && newDesc !== (currentSighting.description || "")) {
      const { error } = await supabase
        .from(tableName)
        .update({ description: newDesc })
        .eq('id', currentSighting.id)
        .select()
        .maybeSingle();
      if (!error) {
        currentSighting.description = newDesc;
      } else {
        alert("Failed to save description.");
      }
    }
    if (!newDesc) {
      sightingDescription.innerHTML = '&nbsp;';
    }
  }
});

// --- Image Upload ---
infoImage.addEventListener('click', () => {
  uploadInput.click();
});

uploadInput.onchange = async () => {
  const file = uploadInput.files[0];
  if (!file || !currentSighting?.id) return;

  const publicUrl = await uploadImageAndSaveURL(file, currentSighting.id);
  if (publicUrl) {
    currentSighting.image_url = publicUrl + '?t=' + new Date().getTime();
    infoImage.src = currentSighting.image_url;
  }
};

// --- Info Panel Close ---
document.getElementById('close-panel').addEventListener('click', () => {
  infoPanel.style.display = 'none';
});

// --- Image Aspect Ratio Helper ---
infoImage.onload = () => {
  const aspectRatio = infoImage.naturalWidth / infoImage.naturalHeight;
  if (aspectRatio < 1) {
    infoImage.classList.add('vertical');
  } else {
    infoImage.classList.remove('vertical');
  }
};

// ==========================
// 6. UI ENHANCEMENTS
// ==========================

// --- Barba Transitions ---
barba.init({
  sync: true,
  transitions: [{
    name: 'fade',
    leave(data) {
      return gsap.to(data.current.container, {
        opacity: 0,
        duration: 0.5,
        onComplete: () => window.scrollTo(0, 0)
      });
    },
    enter(data) {
      return gsap.fromTo(data.next.container, {
        opacity: 0
      }, {
        opacity: 1,
        duration: 0.5
      });
    }
  }]
});

// --- SAL Init ---
sal();

// --- Feather Icons ---
feather.replace();