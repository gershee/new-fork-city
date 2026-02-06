import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
config({ path: ".env.local" });

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const fakeUsers = [
  {
    username: "pizza_pete",
    display_name: "Pizza Pete",
    bio: "On a mission to find NYC's best slice. 500+ pizzerias visited.",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=pete",
  },
  {
    username: "coffeequeen",
    display_name: "Sarah Chen",
    bio: "Specialty coffee addict. Pour-over enthusiast. Always chasing the perfect espresso.",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
  },
  {
    username: "foodie_mike",
    display_name: "Mike Rodriguez",
    bio: "Food photographer & blogger. Eating my way through every neighborhood.",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike",
  },
  {
    username: "brooklyn_bites",
    display_name: "Jess Taylor",
    bio: "Brooklyn local. Brunch is a lifestyle. DM me for recs!",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=jess",
  },
  {
    username: "cocktail_chris",
    display_name: "Chris Park",
    bio: "Bartender by night, bar hopper by day. Speakeasy hunter.",
    avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=chris",
  },
];

const listsData: Record<string, Array<{ name: string; emoji: string; color: string; pins: Array<{ name: string; address: string; lat: number; lng: number; rating: number; notes: string; visited: boolean }> }>> = {
  pizza_pete: [
    {
      name: "Best Pizza Spots",
      emoji: "🍕",
      color: "#ff6b6b",
      pins: [
        { name: "Joe's Pizza", address: "7 Carmine St, New York, NY", lat: 40.7303, lng: -74.0023, rating: 5, notes: "The classic NYC slice. Perfect late night spot.", visited: true },
        { name: "L'industrie Pizzeria", address: "254 S 2nd St, Brooklyn, NY", lat: 40.7112, lng: -73.9577, rating: 5, notes: "Burrata slice is life-changing", visited: true },
        { name: "Scarr's Pizza", address: "22 Orchard St, New York, NY", lat: 40.7156, lng: -73.9911, rating: 5, notes: "Fresh milled flour, old school vibes", visited: true },
        { name: "Lucali", address: "575 Henry St, Brooklyn, NY", lat: 40.6803, lng: -73.9983, rating: 5, notes: "Worth the wait. BYOB!", visited: true },
        { name: "Prince Street Pizza", address: "27 Prince St, New York, NY", lat: 40.7231, lng: -73.9946, rating: 4, notes: "Spicy spring square is a must", visited: true },
      ],
    },
    {
      name: "Pizza To Try",
      emoji: "📋",
      color: "#ffd93d",
      pins: [
        { name: "Paulie Gee's", address: "60 Greenpoint Ave, Brooklyn, NY", lat: 40.7295, lng: -73.9582, rating: 0, notes: "Heard great things about their vegan options", visited: false },
        { name: "Emmy Squared", address: "364 Grand St, Brooklyn, NY", lat: 40.7121, lng: -73.9562, rating: 0, notes: "Detroit style - need to try", visited: false },
      ],
    },
  ],
  coffeequeen: [
    {
      name: "Best Coffee Shops",
      emoji: "☕",
      color: "#8b4513",
      pins: [
        { name: "Devoción", address: "69 Grand St, Brooklyn, NY", lat: 40.7184, lng: -73.9882, rating: 5, notes: "Colombian beans, beautiful space, best cortado", visited: true },
        { name: "Sey Coffee", address: "18 Grattan St, Brooklyn, NY", lat: 40.7063, lng: -73.9378, rating: 5, notes: "Light roasts done right. Industrial chic.", visited: true },
        { name: "Abraço", address: "81 E 7th St, New York, NY", lat: 40.7268, lng: -73.9842, rating: 5, notes: "Tiny but mighty. Get the olive oil cake too.", visited: true },
        { name: "Black Fox Coffee", address: "70 Pine St, New York, NY", lat: 40.7068, lng: -74.0074, rating: 4, notes: "Great for FiDi meetings", visited: true },
        { name: "Variety Coffee", address: "368 Graham Ave, Brooklyn, NY", lat: 40.7144, lng: -73.9445, rating: 4, notes: "Solid neighborhood spot", visited: true },
      ],
    },
    {
      name: "Cozy Cafes",
      emoji: "🛋️",
      color: "#deb887",
      pins: [
        { name: "Cafe Grumpy", address: "224 W 20th St, New York, NY", lat: 40.7421, lng: -73.9981, rating: 4, notes: "Good wifi, chill vibes for working", visited: true },
        { name: "Think Coffee", address: "248 Mercer St, New York, NY", lat: 40.7291, lng: -73.9959, rating: 3, notes: "Spacious, good for groups", visited: true },
      ],
    },
  ],
  foodie_mike: [
    {
      name: "Photo-Worthy Food",
      emoji: "📸",
      color: "#ff2d92",
      pins: [
        { name: "Katz's Delicatessen", address: "205 E Houston St, New York, NY", lat: 40.7223, lng: -73.9874, rating: 5, notes: "Iconic pastrami. The lighting is perfect.", visited: true },
        { name: "Russ & Daughters", address: "179 E Houston St, New York, NY", lat: 40.7222, lng: -73.9882, rating: 5, notes: "Bagel and lox dreams", visited: true },
        { name: "Xi'an Famous Foods", address: "67 Bayard St, New York, NY", lat: 40.7149, lng: -73.9984, rating: 5, notes: "Hand-pulled noodles in action", visited: true },
        { name: "Dominique Ansel Bakery", address: "189 Spring St, New York, NY", lat: 40.7249, lng: -74.0019, rating: 4, notes: "Cronut still worth it for the gram", visited: true },
      ],
    },
    {
      name: "Hidden Gems",
      emoji: "💎",
      color: "#00f0ff",
      pins: [
        { name: "Shu Jiao Fu Zhou", address: "118 Eldridge St, New York, NY", lat: 40.7176, lng: -73.9923, rating: 5, notes: "Best dumplings, no frills", visited: true },
        { name: "Taqueria Ramirez", address: "94 Franklin St, Brooklyn, NY", lat: 40.7218, lng: -73.9578, rating: 5, notes: "Tiny spot, huge flavors", visited: true },
        { name: "Punjabi Grocery & Deli", address: "114 E 1st St, New York, NY", lat: 40.7243, lng: -73.9877, rating: 4, notes: "24/7 Indian food under $10", visited: true },
      ],
    },
  ],
  brooklyn_bites: [
    {
      name: "Brunch Spots",
      emoji: "🥞",
      color: "#f0b429",
      pins: [
        { name: "Egg", address: "109 N 3rd St, Brooklyn, NY", lat: 40.7171, lng: -73.9612, rating: 5, notes: "Southern breakfast perfection", visited: true },
        { name: "Five Leaves", address: "18 Bedford Ave, Brooklyn, NY", lat: 40.7225, lng: -73.9571, rating: 4, notes: "Great people watching, solid pancakes", visited: true },
        { name: "Sunday in Brooklyn", address: "348 Wythe Ave, Brooklyn, NY", lat: 40.7143, lng: -73.9625, rating: 5, notes: "The malted pancakes are unreal", visited: true },
        { name: "Gertie", address: "357 Grand St, Brooklyn, NY", lat: 40.7123, lng: -73.9564, rating: 4, notes: "Jewish deli meets modern brunch", visited: true },
      ],
    },
    {
      name: "Date Night",
      emoji: "🌙",
      color: "#b14eff",
      pins: [
        { name: "Lilia", address: "567 Union Ave, Brooklyn, NY", lat: 40.7148, lng: -73.9512, rating: 5, notes: "Pasta worth the splurge", visited: true },
        { name: "Maison Premiere", address: "298 Bedford Ave, Brooklyn, NY", lat: 40.7136, lng: -73.9614, rating: 5, notes: "Oysters and absinthe, very romantic", visited: true },
        { name: "Win Son", address: "159 Graham Ave, Brooklyn, NY", lat: 40.7098, lng: -73.9446, rating: 4, notes: "Taiwanese fusion, fun vibes", visited: true },
      ],
    },
  ],
  cocktail_chris: [
    {
      name: "Best Cocktail Bars",
      emoji: "🍸",
      color: "#00f0ff",
      pins: [
        { name: "Attaboy", address: "134 Eldridge St, New York, NY", lat: 40.7187, lng: -73.9918, rating: 5, notes: "No menu, just tell them what you like. Trust.", visited: true },
        { name: "Death & Co", address: "433 E 6th St, New York, NY", lat: 40.7257, lng: -73.9838, rating: 5, notes: "The OG craft cocktail bar", visited: true },
        { name: "Please Don't Tell", address: "113 St Marks Pl, New York, NY", lat: 40.7276, lng: -73.9852, rating: 5, notes: "Phone booth entrance never gets old", visited: true },
        { name: "The Long Island Bar", address: "110 Atlantic Ave, Brooklyn, NY", lat: 40.6908, lng: -73.9961, rating: 5, notes: "Classic cocktails in a retro diner setting", visited: true },
      ],
    },
    {
      name: "Speakeasies",
      emoji: "🚪",
      color: "#1a1a2e",
      pins: [
        { name: "Angel's Share", address: "8 Stuyvesant St, New York, NY", lat: 40.7297, lng: -73.9897, rating: 5, notes: "Hidden inside a Japanese restaurant. Intimate.", visited: true },
        { name: "The Back Room", address: "102 Norfolk St, New York, NY", lat: 40.7189, lng: -73.9875, rating: 4, notes: "Actual Prohibition-era bar. Drinks in teacups.", visited: true },
        { name: "Raines Law Room", address: "48 W 17th St, New York, NY", lat: 40.7388, lng: -73.9940, rating: 4, notes: "Ring the doorbell, velvet couches await", visited: true },
      ],
    },
    {
      name: "Dive Bars I Love",
      emoji: "🍺",
      color: "#ff6b6b",
      pins: [
        { name: "Rudy's Bar & Grill", address: "627 9th Ave, New York, NY", lat: 40.7599, lng: -73.9925, rating: 4, notes: "Free hot dogs with your cheap beer", visited: true },
        { name: "Welcome to the Johnsons", address: "123 Rivington St, New York, NY", lat: 40.7203, lng: -73.9869, rating: 4, notes: "70s basement vibes, pool table", visited: true },
      ],
    },
  ],
};

async function seedUsers() {
  console.log("Starting seed process...\n");

  for (const userData of fakeUsers) {
    console.log(`Processing user: ${userData.username}`);

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(
      (u) => u.email === `${userData.username}@fake.nyc.fun`
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`  Found existing auth user: ${userId}`);
    } else {
      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: `${userData.username}@fake.nyc.fun`,
        password: "password123",
        email_confirm: true,
        user_metadata: {
          username: userData.username,
          display_name: userData.display_name,
        },
      });

      if (authError) {
        console.error(`  Error creating auth user: ${authError.message}`);
        continue;
      }

      userId = authUser.user.id;
      console.log(`  Created auth user: ${userId}`);
    }

    // Create profile explicitly (in case trigger doesn't exist)
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        username: userData.username,
        display_name: userData.display_name,
        bio: userData.bio,
        avatar_url: userData.avatar_url,
      });

    if (profileError) {
      console.error(`  Error creating profile: ${profileError.message}`);
      continue;
    }
    console.log(`  Created profile`);

    // Create lists and pins for this user
    const userLists = listsData[userData.username] || [];

    for (const listData of userLists) {
      console.log(`  Creating list: ${listData.name}`);

      const { data: list, error: listError } = await supabase
        .from("lists")
        .insert({
          user_id: userId,
          name: listData.name,
          emoji_icon: listData.emoji,
          color: listData.color,
          is_public: true,
        })
        .select()
        .single();

      if (listError) {
        console.error(`    Error creating list: ${listError.message}`);
        continue;
      }

      // Create pins for this list
      for (const pinData of listData.pins) {
        const { error: pinError } = await supabase.from("pins").insert({
          user_id: userId,
          list_id: list.id,
          name: pinData.name,
          address: pinData.address,
          lat: pinData.lat,
          lng: pinData.lng,
          personal_rating: pinData.rating || null,
          personal_notes: pinData.notes,
          is_visited: pinData.visited,
        });

        if (pinError) {
          console.error(`    Error creating pin ${pinData.name}: ${pinError.message}`);
        }
      }

      console.log(`    Added ${listData.pins.length} pins`);
    }

    console.log("");
  }

  console.log("Seed complete!");
}

seedUsers().catch(console.error);
