"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { gameHeroes } from "@/lib/config";
import { Reveal } from "./Reveal";
import { SectionHeader, SectionShell } from "./SectionHeader";
import { GlowCard } from "./GlowCard";

type GameTheme = "word" | "brawler";

const wordLetters = ["W", "O", "R", "D", "?"] as const;
const brawlerFrontHeroes = [gameHeroes[0], gameHeroes[2]] as const;
const brawlerBackHeroes = [gameHeroes[1], gameHeroes[0], gameHeroes[3]] as const;

function GameFlipCard({
  theme,
  frontTitle,
  frontTagline,
  frontDescription,
  backTitle,
  backBody,
  variant = "default",
}: {
  theme: GameTheme;
  frontTitle: string;
  frontTagline: string;
  frontDescription: string;
  backTitle: string;
  backBody: string;
  variant?: "default" | "honey";
}) {
  const frontClass =
    theme === "word" ? "game-flip-front-word" : "game-flip-front-brawler";
  const backClass = theme === "word" ? "game-flip-back-word" : "game-flip-back-brawler";

  return (
    <GlowCard
      variant={variant}
      scrollGlance
      className="flip-card h-[360px] w-full overflow-hidden rounded-3xl"
    >
      <div className="flip-card-inner relative h-full w-full">
        <div
          className={`flip-card-front game-flip-face absolute inset-0 flex flex-col justify-between rounded-3xl border border-border/40 p-6 ${frontClass}`}
        >
          {theme === "brawler" ? (
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {brawlerFrontHeroes.map((hero, index) => (
                <div
                  key={hero.id}
                  className={`absolute opacity-30 ${index === 0 ? "-right-4 bottom-0 h-44 w-44" : "left-2 top-6 h-32 w-32"}`}
                >
                  <Image src={hero.image} alt="" fill className="object-contain drop-shadow-lg" sizes="176px" />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="pointer-events-none absolute right-4 top-4 flex gap-1.5"
              aria-hidden="true"
            >
              {wordLetters.map((letter) => (
                <span key={letter} className="game-flip-letter">
                  {letter}
                </span>
              ))}
            </div>
          )}

          <div className="relative z-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
              {frontTagline}
            </p>
            <h3 className="mt-3 text-3xl font-bold text-white drop-shadow-sm">{frontTitle}</h3>
          </div>
          <p className="relative z-10 text-base leading-relaxed text-white/90">{frontDescription}</p>
        </div>

        <div className="flip-card-back game-flip-face absolute inset-0 overflow-hidden rounded-3xl border border-border">
          <div className={`absolute inset-0 ${backClass}`} aria-hidden="true" />

          {theme === "brawler" ? (
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {brawlerBackHeroes.map((hero, index) => (
                <div
                  key={hero.id}
                  className={`absolute opacity-25 ${[
                    "right-[-1rem] top-[-0.5rem] h-36 w-36",
                    "bottom-[-0.5rem] left-[-0.5rem] h-40 w-40",
                    "right-[30%] top-[38%] h-28 w-28",
                  ][index]}`}
                >
                  <Image src={hero.image} alt="" fill className="object-contain" sizes="160px" />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="pointer-events-none absolute left-5 top-5 flex flex-wrap gap-2"
              aria-hidden="true"
            >
              <span className="game-flip-chip">Co-op</span>
              <span className="game-flip-chip">Versus</span>
              <span className="game-flip-chip">Clues</span>
            </div>
          )}

          <div className="relative z-10 flex h-full flex-col justify-center p-6">
            {theme === "brawler" ? (
              <span className="game-flip-arena-tag mb-4 w-fit">Arena ready</span>
            ) : null}
            <h3
              className={`text-2xl font-bold ${theme === "brawler" ? "text-white" : "text-foreground"}`}
            >
              {backTitle}
            </h3>
            <p
              className={`mt-3 leading-relaxed ${theme === "brawler" ? "text-white/80" : "text-text-secondary"}`}
            >
              {backBody}
            </p>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

export function GamesSection() {
  const t = useTranslations("games");

  return (
    <SectionShell id="games" background="muted">
      <SectionHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <GameFlipCard
            theme="word"
            frontTitle={t("word.name")}
            frontTagline={t("word.tagline")}
            frontDescription={t("word.description")}
            backTitle={t("word.backTitle")}
            backBody={t("word.backBody")}
          />
        </Reveal>
        <Reveal delay={0.08}>
          <GameFlipCard
            theme="brawler"
            frontTitle={t("brawler.name")}
            frontTagline={t("brawler.tagline")}
            frontDescription={t("brawler.description")}
            backTitle={t("brawler.backTitle")}
            backBody={t("brawler.backBody")}
            variant="honey"
          />
        </Reveal>
      </div>

      <div className="mt-16">
        <SectionHeader
          eyebrow={t("heroesTitle")}
          title={t("heroesSubtitle")}
          align="center"
          accent={false}
        />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {gameHeroes.map((hero, index) => (
          <Reveal key={hero.id} delay={index * 0.05}>
            <GlowCard scrollGlance className="overflow-hidden rounded-3xl border border-border bg-surface p-4">
              <div className="relative mx-auto aspect-square w-full max-w-[120px]">
                <Image
                  src={hero.image}
                  alt={hero.id}
                  fill
                  className="object-contain"
                  sizes="120px"
                />
              </div>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
