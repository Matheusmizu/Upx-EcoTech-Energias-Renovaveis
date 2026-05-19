#include <LiquidCrystal.h>

// LCD nos pinos RS, E, D4, D5, D6, D7
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

// Pinos dos sensores
const int sensorSolo = A0;
const int sensorNivelAgua = A1;
const int sensorChuva = 8;

// Pinos das bombas
const int pinoBomba1 = 9; // Bomba principal (rega)
const int pinoBomba2 = 6; // Bomba transferência

unsigned long tempoAnterior = 0;
const unsigned long intervaloTela = 3000;
int telaAtual = 0;

void setup() {
  Serial.begin(9600);
  lcd.begin(16, 2);

  pinMode(pinoBomba1, OUTPUT);
  pinMode(pinoBomba2, OUTPUT);
  pinMode(sensorChuva, INPUT_PULLUP);

  digitalWrite(pinoBomba1, LOW);
  digitalWrite(pinoBomba2, LOW);

  lcd.setCursor(0, 0);
  lcd.print("TELHADO VERDE");
  lcd.setCursor(0, 1);
  lcd.print(" AUTOMATIZADO");
  delay(3000);
  lcd.clear();
}

void loop() {
  int umidade = analogRead(sensorSolo);
  int nivelAgua = analogRead(sensorNivelAgua);
  int chuva = digitalRead(sensorChuva); // 0 = chovendo, 1 = seco

  // Mostrar no Serial Monitor
  Serial.print("Umidade: ");
  Serial.print(umidade);
  Serial.print(" | Nivel: ");
  Serial.print(nivelAgua);
  Serial.print(" | Chuva: ");
  Serial.println(chuva == 0 ? "Sim" : "Nao");

  // ----------- Lógica da Bomba 1 (Irrigação) -----------
  bool soloSeco = umidade < 500;
  bool caixaComAgua = nivelAgua > 300;
  bool naoEstaChovendo = chuva == 1;

  if (soloSeco && caixaComAgua && naoEstaChovendo) {
    digitalWrite(pinoBomba1, HIGH);
  } else {
    digitalWrite(pinoBomba1, LOW);
  }

  // ----------- Lógica da Bomba 2 (Transferência) -----------
  bool nivelMuitoAlto = nivelAgua > 600; // <-- VALOR ATUALIZADO
  if (nivelMuitoAlto) {
    digitalWrite(pinoBomba2, HIGH);
  } else {
    digitalWrite(pinoBomba2, LOW);
  }

  // ----------- Alternância entre telas do LCD -----------
  if (millis() - tempoAnterior >= intervaloTela) {
    tempoAnterior = millis();
    telaAtual = (telaAtual + 1) % 3;
    lcd.clear();
  }

  switch (telaAtual) {
    case 0:
      lcd.setCursor(0, 0);
      lcd.print("UMID: ");
      lcd.print(umidade);
      lcd.setCursor(0, 1);
      lcd.print("NIV: ");
      lcd.print(nivelAgua);
      lcd.print(" CHU:");
      lcd.print(chuva == 0 ? "SIM" : "NAO");
      break;

    case 1:
      lcd.setCursor(0, 0);
      lcd.print("BOMBA 1 (REGA):");
      lcd.setCursor(0, 1);
      lcd.print(digitalRead(pinoBomba1) == HIGH ? "   LIGADA   " : " DESLIGADA ");
      break;

    case 2:
      lcd.setCursor(0, 0);
      lcd.print("BOMBA 2 (CAIXA):");
      lcd.setCursor(0, 1);
      lcd.print(digitalRead(pinoBomba2) == HIGH ? "   LIGADA   " : " DESLIGADA ");
      break;
  }
}
