const { assert, expect } = require("ethers")
const {deployments, ethers, getNamedAccounts} = require("hardhat")
const {developmentChains} = require("../../helper-hardhat-config")

developmentChains.includes(network.name) 
    ? describe.skip :
describe("FundMe",async () => {
    let fundMe 
    let deployer
    let mockV3Aggregator 
    const sendValue = ethers.utils.parseEther("1") // 1 ETH
    beforeEach(async () => {
        // deploy our fundMe contract
        // using Hardhat-deploy
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        fundMe = await ethers.getContract("FundMe", deployer)
        mockV3Aggregator = await ethers.getContract("MockV3Aggregator", deployer)
    })

    describe("constructor", async () => {
        it("sets the aggregator addresses correctly", async () => {
            const response = await fundMe.getPriceFeed()
            assert.equal(response, mockV3Aggregator.address)
        })
    })

    describe("fund", async () => {
        it("Fails if you don't send enough ETH", async () => {
            await expect(fundMe.fund()).to.be.revertedWith("You need to spend more ETH")
        })

        it("Updated amount of ETH", async () => {
            await fundMe.fund({value: sendValue})
            const response = await fundMe.getAddressToAmountFunded(deployer)
            assert.equal(response.toString(), sendValue.toString())
        })

        it("Adds funder to array pof getfunder", async () => {
            await fundMe.fund({value: sendValue})
            const response = await fundMe.getfunder(0)
            assert.equal(response, deployer)
        })
    })

    describe("Withdraw", async () => {
        beforeEach(async () => {
            await fundMe.fund({value: sendValue})
        })


        // IMPORTANT
        it("withdraw ETH from a singler founder", async () => {
            // Arrange
            const startingFundMeBalance = await ethers.provider.getBalance(fundMe.address)
            const startingDeployerBalance = await ethers.provider.getBalance(deployer)
            // Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)
            const {gasUsed, effectiveGasPrice} = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            const endingFundMeBalance = await ethers.provider.getBalance(fundMe.address)
            const endingDeployerBalance = await ethers.provider.getBalance(deployer)
            // Assert
            assert.equal(endingFundMeBalance.toString(), 0)
            assert.equal(startingFundMeBalance.add(startingDeployerBalance).toString() , endingDeployerBalance.add(gasCost).toString())
        })

        it("withdraw ETH from multiple founders", async () => {
            // Arrange
            const accounts = await ethers.getSigners()
            for(let i = 1; i<6; i++) {
                const fundMeConnectedContract = await fundMe.connect(accounts[i])
                await fundMeConnectedContract.fund({value: sendValue})
            }
            const startingFundMeBalance = await ethers.provider.getBalance(fundMe.address)
            const startingDeployerBalance = await ethers.provider.getBalance(deployer)

            // Act
            const transactionResponse = await fundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)
            const {gasUsed, effectiveGasPrice} = transactionReceipt
            const gasCost = gasUsed.mul(effectiveGasPrice)

            // Assert
            assert.equal(endingFundMeBalance.toString(), 0)
            assert.equal(startingFundMeBalance.add(startingDeployerBalance).toString() , endingDeployerBalance.add)

            // Make sure that the getfunder are reset properly
            await expect(fundMe.getfunder(0)).to.be.reverted

            for (i=1; i<6; i++) {
                assert.equal(await fundMe.getAddressToAmountFunded(accounts[i].address), 0)
            }
        })

        it("Only allows the owner to withdraw", async () => {
            const accounts = await ethers.getSigners()
            const attacker = accounts[1]
            const attackerConnectedContract = await fundMe.connect(attacker)
            await expect(attackerConnectedContract.withdraw()).to.be.revertedWith("FundMe__NotOwner")
        })
    })
})