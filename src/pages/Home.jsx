{animeList.map((anime) => (
  <AnimeCard
    key={anime.mal_id}
    anime={{
      id: anime.mal_id,
      title: anime.title || "Untitled Anime",
      image: anime.images?.jpg?.large_image_url || "https://via.placeholder.com/300x450?text=Anime"
    }}
  />
))}
