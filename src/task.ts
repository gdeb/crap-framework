// type Executor = (result: (any | undefined)) => any;

// export default class Task {
//   state: "pending" | "success" | "fail" = "pending";

//   constructor(executor: Executor) {
//     this.start(executor);
//   }
//   private async start(executor: Executor) {
//     try {
//       await executor(undefined);
//       this.state = "success";
//     } catch {
//       this.state = "pending";
//     }
//   }

//   then(executor: Executor): Task {
//       console.log('eee')
//     return new Task(executor);
//   }
// }

// import Task from "../src/task";

// describe("Task", () => {
//   test("simple task", async () => {
//     expect.assertions(1);
//       expect(1).toBe(3);
//     console.log(333);
//     return new Task(() => 3).then(result => {
//       console.log("babs", result);
//       expect(result).toBe(3);
//       console.log("babs", result);
//     });
//   });
// });
