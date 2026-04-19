/* =========================================================================
 * i18n — English + Spanish, with device-language auto-detection.
 * Persists user choice in localStorage under "ytx.lang".
 * Exposes globals: window.i18n.t(key), window.i18n.lang, window.i18n.setLang(x).
 * ========================================================================= */
(function () {
  const LANG_KEY = "ytx.lang";

  const dict = {
    en: {
      // --- Page / topbar
      "app.title": "YouTube Search Explorer",
      "app.tagline": "Search the YouTube Data API v3 by every parameter it supports — with filters, insights, and saved searches.",
      "topbar.quotaTitle": "Approximate API units used this session",
      "topbar.quotaLabel": "Quota:",
      "topbar.quotaReset": "reset",
      "topbar.langLabel": "Language",
      "warn.noKey": 'No <code>YOUTUBE_API_KEY</code> found. Copy <code>.env.example</code> to <code>.env</code> and add your key.',

      // --- Sidebar groups
      "grp.saved": "Saved searches",
      "grp.query": "Query",
      "grp.dateRegion": "Date & Region",
      "grp.channel": "Channel",
      "grp.engagement": "Engagement (post-filter)",
      "grp.location": "Location",
      "grp.videoFilters": "Video filters",
      "grp.videoFiltersSmall": "(type=video)",

      // --- Saved searches
      "saved.pick": "— pick saved search —",
      "saved.load": "Load",
      "saved.delete": "Delete",
      "saved.save": "Save",
      "saved.namePh": "Name to save current filters…",

      // --- Query
      "q.q": "Search term (q)",
      "q.qPh": "e.g. lofi beats",
      "q.exclude": "Exclude terms (comma separated)",
      "q.excludePh": "shorts, remix",
      "q.or": "Any-of terms (OR, comma separated)",
      "q.orPh": "chill, ambient, focus",
      "q.regex": "Title/description regex (post-filter)",
      "q.regexPh": "^\\[.*\\]|\\b(review|tutorial)\\b",
      "q.type": "Type",
      "q.type.any": "Any (video, channel, playlist)",
      "q.type.video": "Video",
      "q.type.channel": "Channel",
      "q.type.playlist": "Playlist",
      "q.type.vc": "Video + Channel",
      "q.type.vp": "Video + Playlist",
      "q.type.cp": "Channel + Playlist",
      "q.order": "Order",
      "q.order.default": "Relevance (default)",
      "q.order.date": "Date",
      "q.order.rating": "Rating",
      "q.order.relevance": "Relevance",
      "q.order.title": "Title",
      "q.order.videoCount": "Video count",
      "q.order.viewCount": "View count",
      "q.maxResults": "Max results (1-50)",
      "q.safeSearch": "Safe search",
      "q.safeSearch.default": "Default",
      "q.safeSearch.none": "None",
      "q.safeSearch.moderate": "Moderate",
      "q.safeSearch.strict": "Strict",

      // --- Date/region
      "dr.after": "Published after",
      "dr.before": "Published before",
      "dr.region": "Region code (ISO 3166-1)",
      "dr.regionPh": "US, GB, JP…",
      "dr.lang": "Relevance language (ISO 639-1)",
      "dr.langPh": "en, es, fr…",

      // --- Channel
      "ch.id": "Channel ID",
      "ch.idPh": "UCxxxx…",
      "ch.type": "Channel type",
      "ch.type.any": "Any",
      "ch.type.any2": "any",
      "ch.type.show": "show",
      "ch.topic": "Topic ID",
      "ch.topicPh": "/m/…",
      "ch.minSubs": "Min subscribers (post-filter, +1 quota)",
      "ch.minSubsPh": "e.g. 10000",
      "ch.maxSubs": "Max subscribers",
      "ch.maxSubsPh": "e.g. 1000000",
      "ch.include": "Only these channels (IDs or names, comma/newline)",
      "ch.includePh": "UCxxxx, Some Channel Name",
      "ch.exclude": "Exclude these channels",
      "ch.excludePh": "UCxxxx, Some Channel Name",

      // --- Engagement
      "eng.minViews": "Min views",
      "eng.minViewsPh": "10000",
      "eng.maxViews": "Max views",
      "eng.minLikes": "Min likes",
      "eng.maxLikes": "Max likes",
      "eng.minComments": "Min comments",
      "eng.maxComments": "Max comments",
      "eng.likeRatio": "Min like-to-view ratio (%)",
      "eng.likeRatioPh": "e.g. 2",
      "eng.commentRatio": "Min comment-to-view ratio (%)",
      "eng.commentRatioPh": "e.g. 0.5",

      // --- Location
      "loc.location": "Location (lat,lng)",
      "loc.locationPh": "37.42307,-122.08427",
      "loc.radius": "Location radius",
      "loc.radiusPh": "10km (max 1000km)",

      // --- Video filters
      "vf.eventType": "Event type",
      "vf.eventType.any": "Any",
      "vf.eventType.completed": "Completed",
      "vf.eventType.live": "Live",
      "vf.eventType.upcoming": "Upcoming",
      "vf.duration": "Video duration (API bucket)",
      "vf.duration.any": "Any",
      "vf.duration.short": "Short (< 4 min)",
      "vf.duration.medium": "Medium (4-20 min)",
      "vf.duration.long": "Long (> 20 min)",
      "vf.preset": "Precise duration preset",
      "vf.preset.any": "Any",
      "vf.preset.shorts": "Shorts (< 1 min)",
      "vf.preset.1to4": "1 – 4 min",
      "vf.preset.under5": "Under 5 min",
      "vf.preset.4to10": "4 – 10 min",
      "vf.preset.5to15": "5 – 15 min",
      "vf.preset.10to20": "10 – 20 min",
      "vf.preset.15to30": "15 – 30 min",
      "vf.preset.20to60": "20 – 60 min",
      "vf.preset.over30": "Over 30 min",
      "vf.preset.over60": "Over 1 hour",
      "vf.minDuration": "Min duration",
      "vf.minDurationPh": "1:30 or 90 or 2m30s",
      "vf.maxDuration": "Max duration",
      "vf.maxDurationPh": "10:00",
      "vf.definition": "Video definition",
      "vf.definitionSmall": "(API only distinguishes HD vs SD)",
      "vf.definition.any": "Any definition",
      "vf.definition.hd": "HD only (≥ 720p — incl. 1080p, 1440p, 4K, 8K)",
      "vf.definition.sd": "SD only (< 720p)",
      "vf.dimension": "Video dimension",
      "vf.dimension.any": "Any",
      "vf.caption": "Video caption",
      "vf.caption.any": "Any",
      "vf.caption.cc": "Closed caption",
      "vf.caption.none": "None",
      "vf.category": "Video category",
      "vf.categorySmall": "(updates with region)",
      "vf.category.any": "Any category",
      "vf.category.1": "Film & Animation",
      "vf.category.2": "Autos & Vehicles",
      "vf.category.10": "Music",
      "vf.category.15": "Pets & Animals",
      "vf.category.17": "Sports",
      "vf.category.19": "Travel & Events",
      "vf.category.20": "Gaming",
      "vf.category.22": "People & Blogs",
      "vf.category.23": "Comedy",
      "vf.category.24": "Entertainment",
      "vf.category.25": "News & Politics",
      "vf.category.26": "Howto & Style",
      "vf.category.27": "Education",
      "vf.category.28": "Science & Technology",
      "vf.category.29": "Nonprofits & Activism",
      "vf.videoType": "Video type",
      "vf.videoType.any": "Any",
      "vf.videoType.episode": "Episode",
      "vf.videoType.movie": "Movie",
      "vf.license": "Video license",
      "vf.license.any": "Any",
      "vf.license.cc": "Creative Commons",
      "vf.license.standard": "Standard YouTube",
      "vf.embeddable": "Video embeddable",
      "vf.embeddable.any": "Any",
      "vf.embeddable.only": "Embeddable only",
      "vf.syndicated": "Video syndicated",
      "vf.syndicated.any": "Any",
      "vf.syndicated.only": "Syndicated only",
      "vf.paid": "Paid product placement",
      "vf.paid.any": "Any",
      "vf.paid.has": "Has paid placement",
      "vf.paid.none": "No paid placement",

      // --- Actions
      "act.search": "Search",
      "act.reset": "Reset",

      // --- Toolbar
      "tb.sort": "Sort",
      "tb.sort.default": "Default (API order)",
      "tb.sort.views-desc": "Views ↓",
      "tb.sort.views-asc": "Views ↑",
      "tb.sort.likes-desc": "Likes ↓",
      "tb.sort.comments-desc": "Comments ↓",
      "tb.sort.duration-desc": "Duration ↓",
      "tb.sort.duration-asc": "Duration ↑",
      "tb.sort.published-desc": "Newest",
      "tb.sort.published-asc": "Oldest",
      "tb.sort.title-asc": "Title A→Z",
      "tb.sort.likeratio-desc": "Like/View ratio ↓",
      "tb.view": "View",
      "tb.view.grid": "Grid",
      "tb.view.compact": "Compact",
      "tb.view.list": "List",
      "tb.hideWatched": "Hide watched",
      "tb.onlyStarred": "Starred only",
      "tb.refresh": "Refresh",
      "tb.refreshTitle": "Re-query the API with current filters",
      "tb.insights": "Insights",
      "tb.csv": "CSV",
      "tb.json": "JSON",
      "tb.copyUrls": "Copy URLs",
      "tb.copyIds": "Copy IDs",
      "tb.clearWatched": "Clear watched",
      "tb.clearWatchedTitle": "Clear watched history",

      // --- Status
      "status.emptyHtml": 'Enter a search term and hit <kbd>Search</kbd>. Keyboard: <kbd>j</kbd>/<kbd>k</kbd> navigate, <kbd>Enter</kbd> play, <kbd>s</kbd> star, <kbd>/</kbd> focus search.',
      "status.searching": "Searching…",
      "status.noResults": "No results match current filters.",
      "status.filteredOut": "{n} filtered out",
      "status.showing": "Showing {shown} of ~{total} results",
      "status.cachedNote": "cached — click Refresh to re-query",
      "status.watchedCleared": "Watched history cleared",

      // --- Pagination
      "page.prev": "← Previous",
      "page.next": "Next →",

      // --- Modal
      "modal.ariaLabel": "Video player",
      "modal.closeAria": "Close",
      "modal.autoplay": "Autoplay next result",
      "modal.speed": "Speed:",
      "modal.start": "Start",
      "modal.end": "End",
      "modal.apply": "Apply clip",
      "modal.openYt": "Open on YouTube →",
      "modal.comments": "Top comments",
      "modal.commentsLoading": "Loading…",
      "modal.commentsNone": "No comments.",
      "modal.commentsError": "Couldn’t load: {err}",
      "modal.related": "More from this channel",
      "modal.relatedError": "Couldn’t load: {err}",

      // --- Badges & fallback
      "badge.age.title": "Age-restricted — won’t play inline; use Open on YouTube",
      "badge.noembed": "No embed",
      "badge.noembed.title": "Creator disabled embedding — use Open on YouTube",
      "fallback.cantPlay": "Can’t play inline",
      "fallback.reasonAge": "This video is age-restricted.",
      "fallback.reasonNoEmbed": "The creator disabled embedding for this video.",
      "fallback.hint": "If you’re signed in to YouTube in this browser it will play on youtube.com.",

      // --- Insights
      "ins.title": "Insights (current view)",
      "ins.empty": "Run a search with videos to see insights.",
      "ins.videos": "Videos",
      "ins.totalViews": "Total views",
      "ins.avgViews": "Avg views",
      "ins.totalLikes": "Total likes",
      "ins.totalRuntime": "Total runtime",
      "ins.medianDuration": "Median duration",
      "ins.topChannels": "Top channels",
      "ins.durationDist": "Duration distribution",
      "ins.heatmap": "Upload time heatmap (local time)",
      "ins.day.sun": "Sun",
      "ins.day.mon": "Mon",
      "ins.day.tue": "Tue",
      "ins.day.wed": "Wed",
      "ins.day.thu": "Thu",
      "ins.day.fri": "Fri",
      "ins.day.sat": "Sat",

      // --- Errors / toasts
      "err.network": "Network error: {msg}",
      "err.generic": "Error: {msg}",
      "toast.copied": "Copied!",
      "toast.copyFailed": "Copy failed",
      "toast.savedAs": "Saved “{name}”",
      "toast.enterNameFirst": "Enter a name first",

      // --- Card stat suffixes
      "stat.views": "views",
      "stat.likes": "likes",
      "stat.comments": "comments",
      "stat.subs": "subs",
    },

    es: {
      // --- Página / barra superior
      "app.title": "Explorador de búsqueda de YouTube",
      "app.tagline": "Busca en la API de datos de YouTube v3 por todos los parámetros que admite — con filtros, estadísticas y búsquedas guardadas.",
      "topbar.quotaTitle": "Unidades de API usadas esta sesión (aprox.)",
      "topbar.quotaLabel": "Cuota:",
      "topbar.quotaReset": "reiniciar",
      "topbar.langLabel": "Idioma",
      "warn.noKey": 'No se encontró <code>YOUTUBE_API_KEY</code>. Copia <code>.env.example</code> a <code>.env</code> y añade tu clave.',

      // --- Secciones de la barra lateral
      "grp.saved": "Búsquedas guardadas",
      "grp.query": "Consulta",
      "grp.dateRegion": "Fecha y región",
      "grp.channel": "Canal",
      "grp.engagement": "Interacción (post-filtro)",
      "grp.location": "Ubicación",
      "grp.videoFilters": "Filtros de vídeo",
      "grp.videoFiltersSmall": "(type=video)",

      // --- Búsquedas guardadas
      "saved.pick": "— elige una búsqueda —",
      "saved.load": "Cargar",
      "saved.delete": "Eliminar",
      "saved.save": "Guardar",
      "saved.namePh": "Nombre para guardar los filtros actuales…",

      // --- Consulta
      "q.q": "Término de búsqueda (q)",
      "q.qPh": "ej. lofi beats",
      "q.exclude": "Términos a excluir (separados por comas)",
      "q.excludePh": "shorts, remix",
      "q.or": "Términos alternativos (OR, separados por comas)",
      "q.orPh": "chill, ambient, focus",
      "q.regex": "Regex para título/descripción (post-filtro)",
      "q.regexPh": "^\\[.*\\]|\\b(review|tutorial)\\b",
      "q.type": "Tipo",
      "q.type.any": "Cualquiera (vídeo, canal, lista)",
      "q.type.video": "Vídeo",
      "q.type.channel": "Canal",
      "q.type.playlist": "Lista",
      "q.type.vc": "Vídeo + Canal",
      "q.type.vp": "Vídeo + Lista",
      "q.type.cp": "Canal + Lista",
      "q.order": "Orden",
      "q.order.default": "Relevancia (predeterminado)",
      "q.order.date": "Fecha",
      "q.order.rating": "Valoración",
      "q.order.relevance": "Relevancia",
      "q.order.title": "Título",
      "q.order.videoCount": "Nº de vídeos",
      "q.order.viewCount": "Nº de visitas",
      "q.maxResults": "Resultados máx. (1-50)",
      "q.safeSearch": "Búsqueda segura",
      "q.safeSearch.default": "Predeterminada",
      "q.safeSearch.none": "Ninguna",
      "q.safeSearch.moderate": "Moderada",
      "q.safeSearch.strict": "Estricta",

      // --- Fecha / región
      "dr.after": "Publicado después de",
      "dr.before": "Publicado antes de",
      "dr.region": "Código de región (ISO 3166-1)",
      "dr.regionPh": "ES, MX, AR…",
      "dr.lang": "Idioma de relevancia (ISO 639-1)",
      "dr.langPh": "es, en, fr…",

      // --- Canal
      "ch.id": "ID de canal",
      "ch.idPh": "UCxxxx…",
      "ch.type": "Tipo de canal",
      "ch.type.any": "Cualquiera",
      "ch.type.any2": "any",
      "ch.type.show": "show",
      "ch.topic": "ID de tema",
      "ch.topicPh": "/m/…",
      "ch.minSubs": "Suscriptores mín. (post-filtro, +1 cuota)",
      "ch.minSubsPh": "ej. 10000",
      "ch.maxSubs": "Suscriptores máx.",
      "ch.maxSubsPh": "ej. 1000000",
      "ch.include": "Solo estos canales (IDs o nombres, coma/nueva línea)",
      "ch.includePh": "UCxxxx, Nombre de canal",
      "ch.exclude": "Excluir estos canales",
      "ch.excludePh": "UCxxxx, Nombre de canal",

      // --- Interacción
      "eng.minViews": "Visitas mín.",
      "eng.minViewsPh": "10000",
      "eng.maxViews": "Visitas máx.",
      "eng.minLikes": "Likes mín.",
      "eng.maxLikes": "Likes máx.",
      "eng.minComments": "Comentarios mín.",
      "eng.maxComments": "Comentarios máx.",
      "eng.likeRatio": "Ratio mín. likes/visitas (%)",
      "eng.likeRatioPh": "ej. 2",
      "eng.commentRatio": "Ratio mín. comentarios/visitas (%)",
      "eng.commentRatioPh": "ej. 0.5",

      // --- Ubicación
      "loc.location": "Ubicación (lat,lng)",
      "loc.locationPh": "37.42307,-122.08427",
      "loc.radius": "Radio",
      "loc.radiusPh": "10km (máx. 1000km)",

      // --- Filtros de vídeo
      "vf.eventType": "Tipo de evento",
      "vf.eventType.any": "Cualquiera",
      "vf.eventType.completed": "Finalizado",
      "vf.eventType.live": "En directo",
      "vf.eventType.upcoming": "Próximamente",
      "vf.duration": "Duración del vídeo (grupo API)",
      "vf.duration.any": "Cualquiera",
      "vf.duration.short": "Corto (< 4 min)",
      "vf.duration.medium": "Medio (4-20 min)",
      "vf.duration.long": "Largo (> 20 min)",
      "vf.preset": "Duración precisa (preset)",
      "vf.preset.any": "Cualquiera",
      "vf.preset.shorts": "Shorts (< 1 min)",
      "vf.preset.1to4": "1 – 4 min",
      "vf.preset.under5": "Menos de 5 min",
      "vf.preset.4to10": "4 – 10 min",
      "vf.preset.5to15": "5 – 15 min",
      "vf.preset.10to20": "10 – 20 min",
      "vf.preset.15to30": "15 – 30 min",
      "vf.preset.20to60": "20 – 60 min",
      "vf.preset.over30": "Más de 30 min",
      "vf.preset.over60": "Más de 1 hora",
      "vf.minDuration": "Duración mín.",
      "vf.minDurationPh": "1:30 o 90 o 2m30s",
      "vf.maxDuration": "Duración máx.",
      "vf.maxDurationPh": "10:00",
      "vf.definition": "Definición",
      "vf.definitionSmall": "(la API solo distingue HD vs SD)",
      "vf.definition.any": "Cualquiera",
      "vf.definition.hd": "Solo HD (≥ 720p — incl. 1080p, 1440p, 4K, 8K)",
      "vf.definition.sd": "Solo SD (< 720p)",
      "vf.dimension": "Dimensión",
      "vf.dimension.any": "Cualquiera",
      "vf.caption": "Subtítulos",
      "vf.caption.any": "Cualquiera",
      "vf.caption.cc": "Subtítulos cerrados",
      "vf.caption.none": "Ninguno",
      "vf.category": "Categoría de vídeo",
      "vf.categorySmall": "(se actualiza según la región)",
      "vf.category.any": "Cualquier categoría",
      "vf.category.1": "Cine y animación",
      "vf.category.2": "Coches y vehículos",
      "vf.category.10": "Música",
      "vf.category.15": "Mascotas y animales",
      "vf.category.17": "Deportes",
      "vf.category.19": "Viajes y eventos",
      "vf.category.20": "Videojuegos",
      "vf.category.22": "Personas y blogs",
      "vf.category.23": "Comedia",
      "vf.category.24": "Entretenimiento",
      "vf.category.25": "Noticias y política",
      "vf.category.26": "Guías y estilo",
      "vf.category.27": "Educación",
      "vf.category.28": "Ciencia y tecnología",
      "vf.category.29": "ONG y activismo",
      "vf.videoType": "Tipo de vídeo",
      "vf.videoType.any": "Cualquiera",
      "vf.videoType.episode": "Episodio",
      "vf.videoType.movie": "Película",
      "vf.license": "Licencia",
      "vf.license.any": "Cualquiera",
      "vf.license.cc": "Creative Commons",
      "vf.license.standard": "Estándar de YouTube",
      "vf.embeddable": "Incrustable",
      "vf.embeddable.any": "Cualquiera",
      "vf.embeddable.only": "Solo incrustables",
      "vf.syndicated": "Sindicado",
      "vf.syndicated.any": "Cualquiera",
      "vf.syndicated.only": "Solo sindicados",
      "vf.paid": "Colocación de producto pagada",
      "vf.paid.any": "Cualquiera",
      "vf.paid.has": "Con producto pagado",
      "vf.paid.none": "Sin producto pagado",

      // --- Acciones
      "act.search": "Buscar",
      "act.reset": "Restablecer",

      // --- Barra de herramientas
      "tb.sort": "Orden",
      "tb.sort.default": "Predeterminado (orden API)",
      "tb.sort.views-desc": "Visitas ↓",
      "tb.sort.views-asc": "Visitas ↑",
      "tb.sort.likes-desc": "Likes ↓",
      "tb.sort.comments-desc": "Comentarios ↓",
      "tb.sort.duration-desc": "Duración ↓",
      "tb.sort.duration-asc": "Duración ↑",
      "tb.sort.published-desc": "Más nuevos",
      "tb.sort.published-asc": "Más antiguos",
      "tb.sort.title-asc": "Título A→Z",
      "tb.sort.likeratio-desc": "Ratio Likes/Visitas ↓",
      "tb.view": "Vista",
      "tb.view.grid": "Cuadrícula",
      "tb.view.compact": "Compacta",
      "tb.view.list": "Lista",
      "tb.hideWatched": "Ocultar vistos",
      "tb.onlyStarred": "Solo favoritos",
      "tb.refresh": "Actualizar",
      "tb.refreshTitle": "Volver a consultar la API con los filtros actuales",
      "tb.insights": "Estadísticas",
      "tb.csv": "CSV",
      "tb.json": "JSON",
      "tb.copyUrls": "Copiar URLs",
      "tb.copyIds": "Copiar IDs",
      "tb.clearWatched": "Borrar vistos",
      "tb.clearWatchedTitle": "Borrar historial de vistos",

      // --- Estado
      "status.emptyHtml": 'Escribe un término y pulsa <kbd>Buscar</kbd>. Teclado: <kbd>j</kbd>/<kbd>k</kbd> navegar, <kbd>Enter</kbd> reproducir, <kbd>s</kbd> favorito, <kbd>/</kbd> enfocar búsqueda.',
      "status.searching": "Buscando…",
      "status.noResults": "Ningún resultado coincide con los filtros actuales.",
      "status.filteredOut": "{n} descartados",
      "status.showing": "Mostrando {shown} de ~{total} resultados",
      "status.cachedNote": "en caché — pulsa Actualizar para reconsultar",
      "status.watchedCleared": "Historial de vistos borrado",

      // --- Paginación
      "page.prev": "← Anterior",
      "page.next": "Siguiente →",

      // --- Modal
      "modal.ariaLabel": "Reproductor de vídeo",
      "modal.closeAria": "Cerrar",
      "modal.autoplay": "Reproducir siguiente resultado automáticamente",
      "modal.speed": "Velocidad:",
      "modal.start": "Inicio",
      "modal.end": "Fin",
      "modal.apply": "Aplicar clip",
      "modal.openYt": "Abrir en YouTube →",
      "modal.comments": "Comentarios destacados",
      "modal.commentsLoading": "Cargando…",
      "modal.commentsNone": "Sin comentarios.",
      "modal.commentsError": "No se pudo cargar: {err}",
      "modal.related": "Más de este canal",
      "modal.relatedError": "No se pudo cargar: {err}",

      // --- Insignias y fallback
      "badge.age.title": "Restringido por edad — no se reproduce incrustado; usa Abrir en YouTube",
      "badge.noembed": "Sin incrustar",
      "badge.noembed.title": "El creador deshabilitó la inserción — usa Abrir en YouTube",
      "fallback.cantPlay": "No se puede reproducir incrustado",
      "fallback.reasonAge": "Este vídeo está restringido por edad.",
      "fallback.reasonNoEmbed": "El creador deshabilitó la inserción para este vídeo.",
      "fallback.hint": "Si has iniciado sesión en YouTube en este navegador, se reproducirá en youtube.com.",

      // --- Estadísticas
      "ins.title": "Estadísticas (vista actual)",
      "ins.empty": "Haz una búsqueda con vídeos para ver estadísticas.",
      "ins.videos": "Vídeos",
      "ins.totalViews": "Visitas totales",
      "ins.avgViews": "Visitas medias",
      "ins.totalLikes": "Likes totales",
      "ins.totalRuntime": "Duración total",
      "ins.medianDuration": "Duración mediana",
      "ins.topChannels": "Canales principales",
      "ins.durationDist": "Distribución de duración",
      "ins.heatmap": "Mapa de calor de subidas (hora local)",
      "ins.day.sun": "Dom",
      "ins.day.mon": "Lun",
      "ins.day.tue": "Mar",
      "ins.day.wed": "Mié",
      "ins.day.thu": "Jue",
      "ins.day.fri": "Vie",
      "ins.day.sat": "Sáb",

      // --- Errores / toasts
      "err.network": "Error de red: {msg}",
      "err.generic": "Error: {msg}",
      "toast.copied": "¡Copiado!",
      "toast.copyFailed": "Error al copiar",
      "toast.savedAs": "Guardado “{name}”",
      "toast.enterNameFirst": "Introduce un nombre primero",

      // --- Sufijos de las tarjetas
      "stat.views": "visitas",
      "stat.likes": "likes",
      "stat.comments": "comentarios",
      "stat.subs": "subs",
    },
  };

  function detectLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && dict[saved]) return saved;
    } catch {}
    const navLang = (
      (navigator.languages && navigator.languages[0]) ||
      navigator.language ||
      "en"
    ).toLowerCase();
    return navLang.startsWith("es") ? "es" : "en";
  }

  let currentLang = detectLang();

  function t(key, params) {
    const src = (dict[currentLang] && dict[currentLang][key]) || dict.en[key] || key;
    if (!params) return src;
    return src.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
  }

  function applyI18n() {
    document.documentElement.lang = currentLang;
    document.title = t("app.title");

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      const spec = el.getAttribute("data-i18n-attr");
      spec.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s && s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });

    const sel = document.getElementById("lang-select");
    if (sel) sel.value = currentLang;

    document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: currentLang } }));
  }

  function setLang(lang) {
    if (!dict[lang]) return;
    currentLang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
    applyI18n();
  }

  window.i18n = {
    t,
    setLang,
    applyI18n,
    get lang() { return currentLang; },
  };

  document.addEventListener("DOMContentLoaded", () => {
    applyI18n();
    const sel = document.getElementById("lang-select");
    if (sel) {
      sel.value = currentLang;
      sel.addEventListener("change", () => setLang(sel.value));
    }
  });
})();
