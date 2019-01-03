module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(ts|js)x?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"]
};
