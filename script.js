let currentSighting = null;

// Mapbox Init
mapboxgl.accessToken = 'pk.eyJ1IjoicmFobW9uZSIsImEiOiJjbWFsYXZmeHIwN2N5MmtzZHYxd2pna3dmIn0.QMappIJlM50UawPwfgvzUw';

// Supabase setup
const supabaseUrl = "https://pkefuiohsqaydfxbtjqk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZWZ1aW9oc3FheWRmeGJ0anFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0OTcwMDcsImV4cCI6MjA2MzA3MzAwN30.U_RZp_XJH2oNoYvg0z0SdcMRPVUhrxmIw-SMspYKHfU";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const tableName = "sightings";

// Map setup
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-0.1276, 51.5072],
  zoom: 11
});

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


// DOM elements
const infoImage = document.getElementById('info-image');
const uploadInput = document.getElementById('upload-image-input');
const infoPanel = document.getElementById('info-panel');
const infoTimestamp = document.getElementById('info-timestamp');
const sightingNameText = document.getElementById('sighting-name-text');
const editNameButton = document.getElementById('edit-name-button');
const inlineRenameBox = document.querySelector('.inline-rename');
const confirmRenameButton = document.getElementById('confirm-rename');
const renameInput = document.getElementById('rename-input');



// Enable image click to trigger upload
infoImage.addEventListener('click', () => {
  uploadInput.click();
});

// Handle image upload
uploadInput.onchange = async () => {
  const file = uploadInput.files[0];
  if (!file || !currentSighting?.id) return;

  const publicUrl = await uploadImageAndSaveURL(file, currentSighting.id);
  if (publicUrl) {
    // Update currentSighting with the new image URL + cache buster
    currentSighting.image_url = publicUrl + '?t=' + new Date().getTime();

    // Immediately update the image element
    infoImage.src = currentSighting.image_url;
  }
};

// ✏️ Edit button shows input
editNameButton.addEventListener('click', () => {
  renameInput.value = sightingNameText.textContent || "Unnamed";
  sightingNameText.style.display = "none";
  editNameButton.style.display = "none";
  inlineRenameBox.style.display = "inline-block";
  renameInput.focus();
});

// ✅ Confirm name change
confirmRenameButton.addEventListener('click', async () => {
  const newName = renameInput.value.trim();
  if (!newName || !currentSighting?.id) return;

  // Update Supabase
  const { error } = await supabase
    .from(tableName)
    .update({ mode: newName })
    .eq('id', currentSighting.id)
    .select()  // returns updated rows, useful to sync
   .single();
    
    

  if (error) {
    console.error("Failed to rename sighting:", error);
    return;
  }


 
  // Update UI
  currentSighting.mode = newName;
  sightingNameText.textContent = newName;
  sightingNameText.style.display = "inline";
  editNameButton.style.display = "inline";
  inlineRenameBox.style.display = "none";
});



// Fetch sightings from Supabase and add to map
fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  }
})
.then(response => response.json())
.then(data => {
  console.log("Fetched sightings:", data);

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

        // Show panel
        infoPanel.style.display = "block";

        // Set name
        sightingNameText.textContent = sighting.mode || "Unnamed Animal";
        sightingNameText.style.display = "inline";
        editNameButton.style.display = "inline";
        inlineRenameBox.style.display = "none";

        // Timestamp
        infoTimestamp.textContent = timestamp;
        // Image
        infoImage.src = getAnimalImageUrl(sighting);
      });
    }
  });
})
.catch(error => {
  console.error("Error fetching Supabase data:", error);
});

// --- Barba Transitions ---
barba.init({
  sync: true,
  transitions: [{
    name: 'fade',
    leave(data) {
      return gsap.to(data.current.container, {
        opacity: 0,
        duration: 0.5,
        onComplete: () => window.scrollTo(0, 0) // optional scroll reset
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

// --- Scroll Lock Logic ---
let hasUnlocked = false;
let scrollDelta = 0;
const SCROLL_THRESHOLD = 80;
let lastScrollY = 0;

const tagline = document.querySelector('.tagline');
const introSection = document.querySelector('.intro');  // Make sure this is defined

// Lock scrolling initially on page load
window.addEventListener('load', () => {
  document.body.classList.add('locked');
});

window.addEventListener('wheel', (e) => {
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
      e.preventDefault();  // Prevent scrolling while locked
    }
  } else {
    // Lock again if user scrolls back up before the intro section top
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

// Additional scroll event to reset lock if scrolled near top
window.addEventListener('scroll', () => {
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





// Close the info panel when the close button is clicked
document.getElementById('close-panel').addEventListener('click', () => {
  infoPanel.style.display = 'none';
});

infoImage.onload = () => {
  const aspectRatio = infoImage.naturalWidth / infoImage.naturalHeight;
  if (aspectRatio < 1) {
    // Vertical image
    infoImage.classList.add('vertical');
  } else {
    infoImage.classList.remove('vertical');
  }
};

document.querySelector('.scroll-indicator').addEventListener('click', () => {
  window.scrollBy({
    top: window.innerHeight * 0.5,  // scroll down about 80% viewport height
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

const scrollUpIndicator = document.querySelector('.scroll-up-indicator');
const scrollDownIndicator = document.querySelector('.scroll-indicator');
const mapSection = document.querySelector('.map-section');

scrollDownIndicator.addEventListener('click', () => {
  if (document.body.classList.contains('locked')) {
    document.body.classList.remove('locked');
    hasUnlocked = true;
    tagline.classList.add('visible');
    gsap.to(tagline, { opacity: 1, duration: 0.5 });
  }

  // Delay scrollIntoView to allow unlocking to take effect
  setTimeout(() => {
    mapSection.scrollIntoView({ behavior: 'smooth' });
  }, 50); // 50ms delay to allow DOM update and CSS to apply
});



// Scroll up on map arrow click
scrollUpIndicator.addEventListener('click', () => {
  // Scroll smoothly back to intro section top
  introSection.scrollIntoView({ behavior: 'smooth' });
});

// Show/hide scroll arrows based on scroll position
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const windowHeight = window.innerHeight;

  // Hide intro scroll-down arrow if user has scrolled past 90px (your original code)
  if (scrollY > 90) {
    scrollDownIndicator.style.opacity = '0';
    scrollDownIndicator.style.pointerEvents = 'none';
  } else {
    scrollDownIndicator.style.opacity = '1';
    scrollDownIndicator.style.pointerEvents = 'auto';
  }

  // Show scroll-up arrow when user scrolls beyond the intro section bottom (roughly)
  const introBottom = introSection.getBoundingClientRect().bottom + window.scrollY;
  if (scrollY > introBottom) {
    scrollUpIndicator.classList.add('visible');
  } else {
    scrollUpIndicator.classList.remove('visible');
  }
});

document.querySelector('.scroll-indicator').addEventListener('click', () => {
  const mapSection = document.querySelector('.map-section');
  gsap.to(window, { duration: 1, scrollTo: mapSection.offsetTop });
});

document.querySelector('.scroll-up-indicator').addEventListener('click', () => {
  const introSection = document.querySelector('.intro');
  gsap.to(window, { duration: 1, scrollTo: introSection.offsetTop });
});