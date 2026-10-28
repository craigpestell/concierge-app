// Marketing copy for the home page. Kept apart from the page so it can be edited without touching layout.

export const serviceGroups = [
  { title: "Errands & shopping", items: ["Grocery and Costco runs", "Prescription and parcel pickup", "Returns and exchanges", "Donation drop-offs"] },
  { title: "Rides & transportation", items: ["Airport drop-offs and pickups", "Appointments and outings", "Shopping trips with you", "Marketplace pickups"] },
  { title: "Pets & plants", items: ["Dog walks and drop-in visits", "Feeding while you travel", "Vet and groomer runs", "Plant watering"] },
  { title: "Home checks & waiting", items: ["House checks while you're away", "Waiting for repairs or deliveries", "Mail and package collection", "Vacant property checks for Realtors"] },
  { title: "Moves & organizing", items: ["Packing and unpacking", "Cupboard and closet organizing", "Settling in after a move", "Clearing out what's left behind"] },
  { title: "Finding & sourcing", items: ["Researching a purchase", "Finding the best price", "Sourcing affordable appliances", "Ordering and setting up replacements"] },
];

export const familyVisit = [
  ["10:00", "Picked up Mom at her apartment near Queen's Park"],
  ["10:20", "Grocery shop together, Royal City Centre"],
  ["11:40", "Pharmacy pickup, refill ready for next week"],
  ["12:15", "Lunch put away, hallway lightbulb replaced"],
  ["12:45", "Ordered a new kettle she picked out online"],
  ["13:00", "Update sent to her daughter in Calgary"],
] as const;

export const notIncluded = ["Personal or medical care", "Giving medications", "Childcare", "Licensed trades or major repairs"];

export function faqs(name: string, cancelFreeHours: number) {
  return [
    {
      q: `Where does ${name} work?`,
      a: "New Westminster and Burnaby. Trips beyond that, such as airport runs or a pickup in Surrey, are no problem and include a mileage charge.",
    },
    {
      q: "I live out of town. Can I book help for my mom or dad?",
      a: `Yes, and many families do. You book and pay, ${name} visits, and you get an update after every visit.`,
    },
    {
      q: "How do purchases work?",
      a: `For small purchases ${name} pays and adds the exact amount to your invoice with the receipt. For larger items she'll confirm the price with you first.`,
    },
    {
      q: "What's the cancellation policy?",
      a: `Free with ${cancelFreeHours} hours' notice. Later cancellations are charged the one-hour minimum.`,
    },
    {
      q: "Can you take care of my pets while I travel?",
      a: `Yes. ${name} does drop-in visits for feeding, walks, litter and a check on the house. Book early around holidays.`,
    },
  ];
}
