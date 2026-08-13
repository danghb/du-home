import styles from './WeatherScene.module.css';

type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm';

function weatherKind(condition: string): WeatherKind {
  if (/雷|暴/.test(condition)) return 'storm';
  if (/雪|冰/.test(condition)) return 'snow';
  if (/雨|阵雨/.test(condition)) return 'rain';
  if (/晴/.test(condition) && !/云|阴/.test(condition)) return 'clear';
  return 'cloudy';
}

export function WeatherScene({ condition, large = false }: { condition: string; large?: boolean }) {
  const kind = weatherKind(condition);

  return (
    <div className={`${styles.scene} ${styles[kind]} ${large ? styles.large : ''}`} aria-hidden="true">
      <div className={styles.glow} />
      <svg viewBox="0 0 180 140" role="presentation">
        <g className={styles.sun}>
          <circle className={styles.sunGlow} cx="116" cy="48" r="30" />
          <circle className={styles.sunCore} cx="116" cy="48" r="20" />
          <g className={styles.rays}>
            <path d="M116 8v10M116 78v10M76 48h10M146 48h10M88 20l7 7M137 69l7 7M88 76l7-7M137 27l7-7" />
          </g>
        </g>

        <g className={styles.cloudBack}>
          <path d="M45 94c-13 0-23-9-23-21 0-11 8-20 19-21 5-18 21-30 40-30 21 0 38 14 42 34 14 1 25 12 25 27 0 15-12 27-28 27H45Z" />
        </g>
        <g className={styles.cloudFront}>
          <path d="M35 105c-12 0-21-8-21-19 0-10 7-18 17-19 4-16 18-27 35-27 18 0 33 12 37 30 12 1 22 11 22 24 0 14-11 24-25 24H35Z" />
        </g>

        <g className={styles.rainDrops}>
          <path d="M49 113l-5 13M76 113l-5 13M103 113l-5 13" />
        </g>
        <g className={styles.snowflakes}>
          <path d="M48 113v13M42 119h12M74 113v13M68 119h12M100 113v13M94 119h12" />
        </g>
        <path className={styles.lightning} d="M78 104 64 125h12l-5 15 23-25H82l8-11Z" />
      </svg>
    </div>
  );
}
