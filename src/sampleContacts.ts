import type { Contact } from "./types";

const firstNames = [
  "Aarav", "Ananya", "Rahul", "Priya", "Vikram", "Meera", "Arjun", "Kavya", "Aditya", "Diya",
  "Rohan", "Isha", "Karan", "Nisha", "Sanjay", "Aditi", "Manav", "Riya", "Dev", "Sana"
];
const lastNames = ["Sharma", "Patel", "Reddy", "Gupta", "Singh", "Kapoor", "Das", "Nair", "Mehta", "Iyer"];

export function generateDemoContacts(count = 1248): Contact[] {
  return Array.from({ length: count }, (_, index) => {
    const serial = index + 1;
    const consent = serial % 13 === 0 ? "suppressed" : serial % 5 === 0 ? "needs_consent" : "opted_in";
    const phoneTail = String(7600000000 + serial).slice(-10);

    return {
      id: `demo-${serial}`,
      name: `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`,
      phone: `+91${phoneTail}`,
      source: serial % 3 === 0 ? "Website form" : serial % 3 === 1 ? "Event registration" : "Sales import",
      consent,
      createdAt: new Date(Date.now() - serial * 86_400_000).toISOString(),
      tags: serial % 7 === 0 ? ["VIP"] : serial % 4 === 0 ? ["New"] : ["Customer"]
    };
  });
}
