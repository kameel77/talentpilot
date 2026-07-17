"""Seed script for 34 CliftonStrengths talents.

Run this script after initial migration to populate the talents table.

Usage:
    python scripts/seed_talents.py
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Talent, TalentTranslation, GallupDomain

# 34 CliftonStrengths talents with descriptions and domain mappings
PL_TALENT_NAMES = {
    "achiever": "Osiąganie",
    "arranger": "Organizator",
    "belief": "Pryncypialność",
    "consistency": "Sprawiedliwość",
    "deliberative": "Rozwaga",
    "discipline": "Dyscyplina",
    "focus": "Ukierunkowanie",
    "responsibility": "Odpowiedzialność",
    "restorative": "Naprawianie",
    "activator": "Aktywator",
    "command": "Dowodzenie",
    "communication": "Komunikatywność",
    "competition": "Rywalizacja",
    "maximizer": "Maksymalista",
    "self-assurance": "Pewność siebie",
    "significance": "Poważanie",
    "woo": "Czar",
    "adaptability": "Elastyczność",
    "connectedness": "Współzależność",
    "developer": "Rozwijanie",
    "empathy": "Empatia",
    "harmony": "Zgodność",
    "includer": "Integrator",
    "individualization": "Indywidualizacja",
    "positivity": "Optymista",
    "relator": "Bliskość",
    "analytical": "Analityk",
    "context": "Kontekst",
    "futuristic": "Wizjoner",
    "ideation": "Odkrywczość",
    "input": "Zbieranie",
    "intellection": "Intelekt",
    "learner": "Uczenie się",
    "strategic": "Strateg",
}

# Polish short descriptions (authored from official Gallup theme descriptions)
PL_TALENT_SHORT_DESCRIPTIONS = {
    "achiever": "Ogromna wytrwałość i satysfakcja z bycia produktywnym",
    "arranger": "Elastyczne organizowanie ludzi i zasobów dla maksymalnej produktywności",
    "belief": "Trwałe wartości, które nadają życiu sens i kierunek",
    "consistency": "Równe traktowanie wszystkich według jasnych zasad",
    "deliberative": "Ostrożność w decyzjach i staranne przewidywanie przeszkód",
    "discipline": "Potrzeba rutyny, struktury i uporządkowanego świata",
    "focus": "Wyznaczanie kierunku i konsekwentne dążenie do celu",
    "responsibility": "Poczucie własności zobowiązań i dotrzymywanie słowa",
    "restorative": "Biegłość w diagnozowaniu i rozwiązywaniu problemów",
    "activator": "Zamienianie myśli w działanie — od razu",
    "command": "Silna obecność, przejmowanie kontroli i wyrażanie zdania wprost",
    "communication": "Łatwość ubierania myśli w słowa w rozmowie i prezentacji",
    "competition": "Mierzenie postępów na tle innych i dążenie do zwycięstwa",
    "maximizer": "Przekształcanie mocnych stron w doskonałość",
    "self-assurance": "Wewnętrzna pewność własnych osądów i możliwości",
    "significance": "Pragnienie dużego wpływu i bycia docenianym",
    "woo": "Radość ze zdobywania sympatii nowo poznanych osób",
    "adaptability": "Życie chwilą i spokojne przyjmowanie zmian",
    "connectedness": "Wiara, że wszystko jest ze sobą powiązane i ma sens",
    "developer": "Dostrzeganie i pielęgnowanie potencjału innych",
    "empathy": "Wyczuwanie emocji innych i patrzenie na świat ich oczami",
    "harmony": "Poszukiwanie zgody i unikanie konfliktów",
    "includer": "Poszerzanie kręgu i włączanie tych, którzy stoją z boku",
    "individualization": "Dostrzeganie wyjątkowych cech każdej osoby",
    "positivity": "Zaraźliwy entuzjazm i dostrzeganie dobrych stron",
    "relator": "Głębokie, autentyczne relacje z bliskimi ludźmi",
    "analytical": "Poszukiwanie przyczyn, dowodów i danych",
    "context": "Rozumienie teraźniejszości przez pryzmat przeszłości",
    "futuristic": "Inspirowanie siebie i innych wizją przyszłości",
    "ideation": "Fascynacja pomysłami i łączenie odległych zjawisk",
    "input": "Kolekcjonowanie informacji, rzeczy i pomysłów",
    "intellection": "Potrzeba aktywności intelektualnej i refleksji",
    "learner": "Radość z samego procesu uczenia się i rozwoju",
    "strategic": "Szybkie dostrzeganie wzorców i alternatywnych dróg",
}

TALENTS_DATA = [
    # EXECUTING Domain
    {
        "code": "achiever",
        "name": "Achiever",
        "domain": GallupDomain.EXECUTING,
        "short_description": "Great stamina and work ethic",
        "description": "People exceptionally talented in the Achiever theme work hard and possess a great deal of stamina. They take immense satisfaction in being busy and productive."
    },
    {
        "code": "arranger",
        "name": "Arranger",
        "domain": GallupDomain.EXECUTING,
        "short_description": "Organize for maximum productivity",
        "description": "People exceptionally talented in the Arranger theme can organize, but they also have a flexibility that complements this ability. They like to determine how all of the pieces and resources can be arranged for maximum productivity."
    },
    {
        "code": "belief",
        "name": "Belief",
        "domain": GallupDomain.EXECUTING,
        "short_description": "Core values guide decisions",
        "description": "People exceptionally talented in the Belief theme have certain core values that are unchanging. Out of these values emerges a defined purpose for their lives."
    },
    {
        "code": "consistency",
        "name": "Consistency",
        "domain": GallupDomain.EXECUTING,
        "short_description": "Treat everyone equally",
        "description": "People exceptionally talented in the Consistency theme are keenly aware of the need to treat people the same. They crave stable routines and clear rules and procedures that everyone can follow."
    },
    {
        "code": "deliberative",
        "name": "Deliberative",
        "domain": GallupDomain.EXECUTING,
        "short_description": "Careful and vigilant",
        "description": "People exceptionally talented in the Deliberative theme are best described by the serious care they take in making decisions or choices. They anticipate obstacles."
    },
    {
        "code": "discipline",
        "name": "Discipline",
        "domain": GallupDomain.EXECUTING,
        "short_description": "Structure and order",
        "description": "People exceptionally talented in the Discipline theme enjoy routine and structure. Their world is best described by the order they create."
    },
    {
        "code": "focus",
        "name": "Focus",
        "domain": GallupDomain.EXECUTING,
        "short_description": "Stay on track toward goals",
        "description": "People exceptionally talented in the Focus theme can take a direction, follow through and make the corrections necessary to stay on track. They prioritize, then act."
    },
    {
        "code": "responsibility",
        "name": "Responsibility",
        "domain": GallupDomain.EXECUTING,
        "short_description": "Psychological ownership",
        "description": "People exceptionally talented in the Responsibility theme take psychological ownership of what they say they will do. They are committed to stable values such as honesty and loyalty."
    },
    {
        "code": "restorative",
        "name": "Restorative",
        "domain": GallupDomain.EXECUTING,
        "short_description": "Solve problems",
        "description": "People exceptionally talented in the Restorative theme are adept at dealing with problems. They are good at figuring out what is wrong and resolving it."
    },
    
    # INFLUENCING Domain
    {
        "code": "activator",
        "name": "Activator",
        "domain": GallupDomain.INFLUENCING,
        "short_description": "Turn thoughts into action",
        "description": "People exceptionally talented in the Activator theme can make things happen by turning thoughts into action. They want to do things now, rather than simply talk about them."
    },
    {
        "code": "command",
        "name": "Command",
        "domain": GallupDomain.INFLUENCING,
        "short_description": "Take charge and make decisions",
        "description": "People exceptionally talented in the Command theme have presence. They can take control of a situation and make decisions."
    },
    {
        "code": "communication",
        "name": "Communication",
        "domain": GallupDomain.INFLUENCING,
        "short_description": "Explain and present ideas",
        "description": "People exceptionally talented in the Communication theme generally find it easy to put their thoughts into words. They are good conversationalists and presenters."
    },
    {
        "code": "competition",
        "name": "Competition",
        "domain": GallupDomain.INFLUENCING,
        "short_description": "Measure success against others",
        "description": "People exceptionally talented in the Competition theme measure their progress against the performance of others. They strive to win first place and revel in contests."
    },
    {
        "code": "maximizer",
        "name": "Maximizer",
        "domain": GallupDomain.INFLUENCING,
        "short_description": "Transform good into great",
        "description": "People exceptionally talented in the Maximizer theme focus on strengths as a way to stimulate personal and group excellence. They seek to transform something strong into something superb."
    },
    {
        "code": "self-assurance",
        "name": "Self-Assurance",
        "domain": GallupDomain.INFLUENCING,
        "short_description": "Confidence in abilities",
        "description": "People exceptionally talented in the Self-Assurance theme feel confident in their ability to take risks and manage their own lives. They have an inner compass that gives them certainty in their decisions."
    },
    {
        "code": "significance",
        "name": "Significance",
        "domain": GallupDomain.INFLUENCING,
        "short_description": "Make an impact",
        "description": "People exceptionally talented in the Significance theme want to make a big impact. They are independent and prioritize projects based on how much influence they will have on their organization or people around them."
    },
    {
        "code": "woo",
        "name": "Woo",
        "domain": GallupDomain.INFLUENCING,
        "short_description": "Win others over",
        "description": "People exceptionally talented in the Woo theme love the challenge of meeting new people and winning them over. They derive satisfaction from breaking the ice and making a connection with someone."
    },
    
    # RELATIONSHIP BUILDING Domain
    {
        "code": "adaptability",
        "name": "Adaptability",
        "domain": GallupDomain.RELATIONSHIP_BUILDING,
        "short_description": "Go with the flow",
        "description": "People exceptionally talented in the Adaptability theme prefer to go with the flow. They tend to be 'now' people who take things as they come and discover the future one day at a time."
    },
    {
        "code": "connectedness",
        "name": "Connectedness",
        "domain": GallupDomain.RELATIONSHIP_BUILDING,
        "short_description": "See links between things",
        "description": "People exceptionally talented in the Connectedness theme have faith in the links among all things. They believe there are few coincidences and that almost every event has meaning."
    },
    {
        "code": "developer",
        "name": "Developer",
        "domain": GallupDomain.RELATIONSHIP_BUILDING,
        "short_description": "Recognize and develop potential",
        "description": "People exceptionally talented in the Developer theme recognize and cultivate the potential in others. They spot the signs of each small improvement and derive satisfaction from evidence of progress."
    },
    {
        "code": "empathy",
        "name": "Empathy",
        "domain": GallupDomain.RELATIONSHIP_BUILDING,
        "short_description": "Sense others' emotions",
        "description": "People exceptionally talented in the Empathy theme can sense other people's feelings by imagining themselves in others' lives or situations."
    },
    {
        "code": "harmony",
        "name": "Harmony",
        "domain": GallupDomain.RELATIONSHIP_BUILDING,
        "short_description": "Seek consensus",
        "description": "People exceptionally talented in the Harmony theme look for consensus. They don't enjoy conflict; rather, they seek areas of agreement."
    },
    {
        "code": "includer",
        "name": "Includer",
        "domain": GallupDomain.RELATIONSHIP_BUILDING,
        "short_description": "Accept and include others",
        "description": "People exceptionally talented in the Includer theme accept others. They show awareness of those who feel left out and make an effort to include them."
    },
    {
        "code": "individualization",
        "name": "Individualization",
        "domain": GallupDomain.RELATIONSHIP_BUILDING,
        "short_description": "See unique qualities in people",
        "description": "People exceptionally talented in the Individualization theme are intrigued with the unique qualities of each person. They have a gift for figuring out how different people can work together productively."
    },
    {
        "code": "positivity",
        "name": "Positivity",
        "domain": GallupDomain.RELATIONSHIP_BUILDING,
        "short_description": "Bring enthusiasm and optimism",
        "description": "People exceptionally talented in the Positivity theme have contagious enthusiasm. They are upbeat and can get others excited about what they are going to do."
    },
    {
        "code": "relator",
        "name": "Relator",
        "domain": GallupDomain.RELATIONSHIP_BUILDING,
        "short_description": "Build deep relationships",
        "description": "People exceptionally talented in the Relator theme enjoy close relationships with others. They find deep satisfaction in working hard with friends to achieve a goal."
    },
    
    # STRATEGIC THINKING Domain
    {
        "code": "analytical",
        "name": "Analytical",
        "domain": GallupDomain.STRATEGIC_THINKING,
        "short_description": "Search for reasons and causes",
        "description": "People exceptionally talented in the Analytical theme search for reasons and causes. They have the ability to think about all of the factors that might affect a situation."
    },
    {
        "code": "context",
        "name": "Context",
        "domain": GallupDomain.STRATEGIC_THINKING,
        "short_description": "Learn from the past",
        "description": "People exceptionally talented in the Context theme enjoy thinking about the past. They understand the present by researching its history."
    },
    {
        "code": "futuristic",
        "name": "Futuristic",
        "domain": GallupDomain.STRATEGIC_THINKING,
        "short_description": "Inspired by the future",
        "description": "People exceptionally talented in the Futuristic theme are inspired by the future and what could be. They energize others with their visions of the future."
    },
    {
        "code": "ideation",
        "name": "Ideation",
        "domain": GallupDomain.STRATEGIC_THINKING,
        "short_description": "Fascinated by ideas",
        "description": "People exceptionally talented in the Ideation theme are fascinated by ideas. They are able to find connections between seemingly disparate phenomena."
    },
    {
        "code": "input",
        "name": "Input",
        "domain": GallupDomain.STRATEGIC_THINKING,
        "short_description": "Collect information and objects",
        "description": "People exceptionally talented in the Input theme have a need to collect and archive. They may accumulate information, ideas, artifacts or even relationships."
    },
    {
        "code": "intellection",
        "name": "Intellection",
        "domain": GallupDomain.STRATEGIC_THINKING,
        "short_description": "Introspective and intellectual",
        "description": "People exceptionally talented in the Intellection theme are characterized by their intellectual activity. They are introspective and appreciate intellectual discussions."
    },
    {
        "code": "learner",
        "name": "Learner",
        "domain": GallupDomain.STRATEGIC_THINKING,
        "short_description": "Love to learn",
        "description": "People exceptionally talented in the Learner theme have a great desire to learn and want to continuously improve. The process of learning, rather than the outcome, excites them."
    },
    {
        "code": "strategic",
        "name": "Strategic",
        "domain": GallupDomain.STRATEGIC_THINKING,
        "short_description": "Find alternative paths",
        "description": "People exceptionally talented in the Strategic theme create alternative ways to proceed. Faced with any given scenario, they can quickly spot the relevant patterns and issues."
    },
]


def seed_talents(db: Session):
    """Seed the talents table with 34 CliftonStrengths talents."""
    
    # Check if talents already exist
    existing_count = db.query(Talent).count()
    if existing_count > 0:
        print(f"⚠️  Talents table already has {existing_count} records. Skipping seeding.")
        return
    
    print("🌱 Seeding 34 CliftonStrengths talents...")
    
    for talent_data in TALENTS_DATA:
        talent = Talent(
            code=talent_data["code"],
            domain=talent_data["domain"],
        )
        db.add(talent)
        db.flush()
        db.add(
            TalentTranslation(
                talent_id=talent.id,
                language="en",
                name=talent_data["name"],
                short_description=talent_data["short_description"],
                description=talent_data["description"],
            )
        )
        db.add(
            TalentTranslation(
                talent_id=talent.id,
                language="pl",
                name=PL_TALENT_NAMES.get(talent_data["code"], talent_data["name"]),
                short_description=PL_TALENT_SHORT_DESCRIPTIONS.get(talent_data["code"]),
            )
        )
    
    db.commit()
    print(f"✅ Successfully seeded {len(TALENTS_DATA)} talents!")
    
    # Print summary by domain
    for domain in GallupDomain:
        count = db.query(Talent).filter(Talent.domain == domain).count()
        print(f"   - {domain.value}: {count} talents")


def main():
    """Main function to run the seed script."""
    print("=" * 50)
    print("TalentPilot - Seed 34 CliftonStrengths Talents")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        seed_talents(db)
    except Exception as e:
        print(f"❌ Error seeding talents: {e}")
        db.rollback()
    finally:
        db.close()
    
    print("=" * 50)


if __name__ == "__main__":
    main()
